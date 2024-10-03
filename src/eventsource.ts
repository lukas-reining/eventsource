import { ConsoleLogger, Logger } from './logger';
import { EventSourceMessage, getLines, getMessages, readChunks } from './parse';

const ContentTypeEventStream = 'text/event-stream';

export type EventSourceOptions = {
  /**
   * Disables connection retrying.
   */
  disableRetry?: boolean;

  /**
   * Delay in milliseconds for retrying connection.
   */
  retry?: number;

  /**
   * Disables logging.
   */
  disableLogger?: boolean;

  /**
   * Logger to use for events and errors. Defaults to console.
   */
  logger?: Logger;

  /**
   * Fetch implementation to use for connecting. Defaults to {@link globalThis.fetch}
   */
  fetch?: typeof fetch;
} & Omit<RequestInit, 'cache' | 'credentials' | 'signal'>;

/**
 * @deprecated
 */
export type EventSourceExtraOptions = {
  /**
   * @deprecated Use {@link EventSourceOptions#fetch} instead
   */
  fetchInput?: typeof fetch;
};

export type CustomEvent = Event & { 
  response?: Response; 
 };

export class CustomEventSource extends EventTarget implements EventSource {
  // https://html.spec.whatwg.org/multipage/server-sent-events.html#dom-eventsource-url
  public url: string;

  // https://html.spec.whatwg.org/multipage/server-sent-events.html#dom-eventsource-readystate
  public readonly CONNECTING = 0;
  public readonly OPEN = 1;
  public readonly CLOSED = 2;
  public readyState = this.CONNECTING;

  // https://html.spec.whatwg.org/multipage/server-sent-events.html#handler-eventsource-onopen
  public onerror: ((this: EventSource, ev: Event) => any) | null = null;
  // https://html.spec.whatwg.org/multipage/server-sent-events.html#handler-eventsource-onmessage
  public onmessage: ((this: EventSource, ev: MessageEvent) => any) | null =
    null;
  // https://html.spec.whatwg.org/multipage/server-sent-events.html#handler-eventsource-onerror
  public onopen: ((this: EventSource, ev: Event) => any) | null = null;

  public onRetryDelayReceived:
    | ((this: EventSource, delay: number) => any)
    | null = null;

  public readonly options: EventSourceInit & EventSourceOptions;
  private readonly extraOptions?: EventSourceExtraOptions;
  private abortController?: AbortController;
  private timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  private retry: number;
  private currentLastEventId?: string;

  private logger?: Logger;

  constructor(
    url: string | URL,
    initDict?: EventSourceInit & EventSourceOptions,
    /**
     * @deprecated Use the related options in initDict
     */
    extraOptions?: EventSourceExtraOptions,
  ) {
    super();
    this.options = initDict ?? {};
    this.extraOptions = extraOptions;
    this.url = url instanceof URL ? url.toString() : url;
    this.retry = initDict?.retry ?? 5000;

    if (!this.options.disableLogger) {
      this.logger = this.options.logger ?? new ConsoleLogger();
    }

    this.connect();
  }

  // https://html.spec.whatwg.org/multipage/server-sent-events.html#dom-eventsource-withcredentials
  public get withCredentials(): boolean {
    return this.options.withCredentials ?? false;
  }

  public get retryDelay(): number {
    return this.retry;
  }

  private async connect(lastEventId?: string) {
    if (this.readyState === this.CLOSED) {
      this.logger?.warn(
        'Canceled reconnecting due to state already being closed',
      );
      return;
    }

    try {
      // https://html.spec.whatwg.org/multipage/server-sent-events.html#dom-eventsource
      this.abortController = new AbortController();
      this.readyState = this.CONNECTING;

      const fetchOptions: RequestInit = {
        ...this.options,
        headers: lastEventId
          ? {
              ...this.options.headers,
              Accept: ContentTypeEventStream,
              'Last-Event-ID': lastEventId,
            }
          : {
              ...this.options.headers,
              Accept: ContentTypeEventStream,
            },
        cache: 'no-store',
        credentials: this.withCredentials ? 'include' : 'omit',
        signal: this.abortController?.signal,
      };

      const response = this.options.fetch
        ? await this.options.fetch(this.url, fetchOptions)
        : this.extraOptions?.fetchInput
        ? await this.extraOptions.fetchInput(this.url, fetchOptions)
        : await globalThis.fetch(this.url, fetchOptions);

      // https://html.spec.whatwg.org/multipage/server-sent-events.html#dom-eventsource (Step 15)
      if (response.status !== 200) {
        return this.failConnection(
          `Request failed with status code ${response.status}`,
          response,
        );
      } else if (
        !response.headers.get('Content-Type')?.includes(ContentTypeEventStream)
      ) {
        return this.failConnection(
          `Request failed with wrong content type '${response.headers.get(
            'Content-Type',
          )}'`,
          response,
        );
      } else if (!response?.body) {
        return this.failConnection(`Request failed with empty response body'`, response);
      }

      this.announceConnection();

      const reader: ReadableStreamDefaultReader<Uint8Array> =
        response.body.getReader();
      const getLine = getLines();
      const getMessage = getMessages();

      for await (const chunk of readChunks(reader)) {
        for await (const [line, fieldLength] of getLine(chunk)) {
          for await (const [message, id, retry] of getMessage(
            line,
            fieldLength,
          )) {
            if (typeof id !== 'undefined') {
              this.currentLastEventId = id;
            } else if (typeof retry !== 'undefined') {
              this.retry = retry;
              this.onRetryDelayReceived?.(retry);
            } else if (message) {
              this.dispatchMessage(
                message,
                this.currentLastEventId,
                response.url,
              );
            }
          }
        }
      }
    } catch (error: any) {
      if (typeof error === 'object' && error?.name === 'AbortError') {
        return;
      }

      await this.reconnect('Reconnecting EventSource because of error', error);
      return;
    }

    await this.reconnect('Reconnecting because EventSource connection closed');
  }

  // https://html.spec.whatwg.org/multipage/server-sent-events.html#reestablish-the-connection
  private async reconnect(msg?: string, error?: unknown) {
    const event = new Event('error');
    this.dispatchEvent(event);
    this.onerror?.(event);

    if (error) {
      this.logger?.warn('Error occurred in EventSource', error ?? '');
    }

    if (this.readyState === this.CLOSED || this.options.disableRetry) {
      return;
    }

    if (msg) {
      this.logger?.warn(msg, error ?? '');
    }

    this.timeoutId = setTimeout(async () => {
      await this.connect(this.currentLastEventId);
    }, this.retry);
  }

  // https://html.spec.whatwg.org/multipage/server-sent-events.html#dispatchMessage
  private dispatchMessage(
    message: EventSourceMessage,
    lastEventId?: string,
    url?: string,
  ) {
    const origin = url && URL.canParse(url) ? new URL(url) : undefined;
    const eventType = !message?.event ? 'message' : message.event;
    const event = new MessageEvent(eventType, {
      data: message?.data,
      // https://html.spec.whatwg.org/multipage/server-sent-events.html#dispatchMessage (Note)
      lastEventId: message?.id || lastEventId,
      origin: origin?.origin,
    });

    this.dispatchEvent(event);
    if (eventType === 'message') {
      this.onmessage?.(event);
    }
  }

  // https://html.spec.whatwg.org/multipage/server-sent-events.html#fail-the-connection
  private failConnection(error: unknown, response: Response) {
    this.logger?.error('Fatal error occurred in EventSource', error);
    this.readyState = this.CLOSED;
    const event: CustomEvent = new Event('error');
    event.response = response;
    this.dispatchEvent(event);
    this.onerror?.(event);
  }

  // https://html.spec.whatwg.org/multipage/server-sent-events.html#announce-the-connection
  private announceConnection() {
    this.logger?.debug('Connection established');
    this.readyState = this.OPEN;
    const event = new Event('open');
    this.dispatchEvent(event);
    this.onopen?.(event);
  }

  // https://html.spec.whatwg.org/multipage/server-sent-events.html#dom-eventsource-close
  public close() {
    this.readyState = this.CLOSED;
    clearTimeout(this.timeoutId);
    this.abortController?.abort();
  }

  override addEventListener(
    type: string,
    listener: (this: EventSource, event: MessageEvent) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener<K extends keyof EventSourceEventMap>(
    type: K,
    listener: (this: EventSource, ev: EventSourceEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject,
      options,
    );
  }

  override removeEventListener(
    type: string,
    listener: (this: EventSource, event: MessageEvent) => any,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener<K extends keyof EventSourceEventMap>(
    type: K,
    listener: (this: EventSource, ev: EventSourceEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject,
      options,
    );
  }
}
