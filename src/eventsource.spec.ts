import { http, HttpResponse as MswHttpResponse } from 'msw';
import { server } from '../mocks/node';
import { CustomEventSource as EventSource } from './eventsource';
import DoneCallback = jest.DoneCallback;

describe('EventSource', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('connects successfully to sse endpoint and emits open event', (done) => {
    mockChunks();

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    ev.onopen = (event) => {
      expect(event).toBeInstanceOf(Event);
      done();
    };
  });

  it('sends custom headers to the backend', (done) => {
    server.use(
      http.get('http://localhost/sse', (request) => {
        expect(request.request.headers.get('Authorization')).toEqual(
          'SecretToken',
        );
        return new MswHttpResponse(new ReadableStream(), {
          headers: {
            'Content-Type': 'text/event-stream',
          },
        });
      }),
    );

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
      headers: {
        Authorization: "SecretToken"
      }
    });

    ev.onopen = () => done();
  });

  it('fails fatally if wrong content type is returned', (done) => {
    server.use(
      http.get('http://localhost/sse', () => {
        return new MswHttpResponse('Wrong Body', {
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }),
    );

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    ev.onerror = () => {
      expect(ev.readyState).toEqual(ev.CLOSED);
      done();
    };
  });

  it('fails fatally if wrong status code is returned', (done) => {
    server.use(
      http.get('http://localhost/sse', () => {
        return new MswHttpResponse(new ReadableStream(), {
          status: 401,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        });
      }),
    );

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    ev.onerror = () => {
      expect(ev.readyState).toEqual(ev.CLOSED);
      done();
    };
  });

  it('fails fatally if empty body is returned', (done) => {
    server.use(
      http.get('http://localhost/sse', () => {
        return new MswHttpResponse(undefined, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        });
      }),
    );

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    ev.onerror = () => {
      expect(ev.readyState).toEqual(ev.CLOSED);
      done();
    };
  });

  it('fails non-fatally on network error and receives events after successful reconnect', (done) => {
    server.use(
      http.get('http://localhost/sse', () => {
        return MswHttpResponse.error();
      }),
    );

    const ev = new EventSource('http://localhost/sse');

    ev.onerror = jest.fn().mockImplementationOnce(() => {
      expect(ev.readyState).toEqual(ev.CONNECTING);
    });

    mockChunks('data: works\n\n');
    expectEvents(
      ev,
      () => {
        expect(ev.onerror).toHaveBeenCalled();
        done();
      },
      'message',
      { data: 'works' },
    );
  });

  it('sets the retry delay when received by the server', (done) => {
    mockChunks('retry: 55555\n\n');

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    ev.onRetryDelayReceived = () => {
      expect(ev.retryDelay).toEqual(55555);
      done();
    };
  });

  it('reads a single data only message correctly', (done) => {
    mockChunks('data: abc\n', '\n');

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    expectEvents(ev, done, 'message', { id: '', data: 'abc' });
  });

  it('reads a single message correctly', (done) => {
    mockChunks('id: 1\n', 'data: abc\n', '\n');

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    expectEvents(ev, done, 'message', { id: '1', data: 'abc' });
  });

  it('reads a single custom event type correctly', (done) => {
    mockChunks('id: 1\n', 'event: custom-event\n', 'data: abc\n', '\n');

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    expectEvents(ev, done, 'custom-event', { id: '1', data: 'abc' });
  });

  it('reads a single message with multiple data lines correctly', (done) => {
    mockChunks('id: 1\n', 'data: abc\n', 'data: def\n', 'data: ghi\n', '\n');

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    expectEvents(ev, done, 'message', { id: '1', data: 'abc\ndef\nghi' });
  });

  it('reads multiple messages correctly', (done) => {
    mockChunks('id: 1\ndata: abc\n\n', 'id: 2\ndata: def\n\n');

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    expectEvents(
      ev,
      done,
      'message',
      { id: '1', data: 'abc' },
      { id: '2', data: 'def' },
    );
  });

  it('uses last event id if message does not contain one', (done) => {
    mockChunks('id: 1\ndata: abc\n', '\n', 'id:\ndata: def\n', '\n');

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    expectEvents(
      ev,
      done,
      'message',
      { id: '1', data: 'abc' },
      { id: '1', data: 'def' },
    );
  });

  it('correctly receives mixed event types', (done) => {
    mockChunks(
      'id: 1\ndata: abc\n\n',
      'id: 2\nevent: custom\ndata: abc\n\n',
      'id: 3\nevent: custom\ndata: def\nretry: 505\ndata: gih\n\n',
      'id: 4\nevent: message\ndata: def\n\n',
    );

    const ev = new EventSource('http://localhost/sse', {
      disableRetry: true,
    });

    let messagesDone = false;
    let customsDone = false;
    const checkDone = () => {
      if (messagesDone && customsDone) {
        done();
      }
    };

    ev.onRetryDelayReceived = () => {
      expect(ev.retryDelay).toEqual(505);
    };
    expectEvents(
      ev,
      () => {
        messagesDone = true;
        checkDone();
      },
      'message',
      { id: '1', data: 'abc' },
      { id: '4', data: 'def' },
    );
    expectEvents(
      ev,
      () => {
        customsDone = true;
        checkDone();
      },
      'custom',
      { id: '2', data: 'abc' },
      { id: '3', data: 'def\ngih' },
    );
  });
});

function expectEvents(
  ev: EventSource,
  done: DoneCallback | (() => void),
  type: string,
  ...events: {
    id?: string;
    data?: string;
    origin?: string;
  }[]
) {
  let numberOfCalls = 0;

  const onMessage = jest.fn((event: MessageEvent) => {
    const expectedEvent = events[numberOfCalls];

    expect(event).toBeInstanceOf(MessageEvent);
    expect(event.type).toEqual(type);

    if (typeof expectedEvent.id !== 'undefined') {
      expect(event.lastEventId).toEqual(expectedEvent.id);
    }
    if (typeof expectedEvent.data !== 'undefined') {
      expect(event.data).toEqual(expectedEvent.data);
    }
    if (typeof expectedEvent.origin !== 'undefined') {
      expect(event.origin).toEqual(expectedEvent.origin);
    }

    if (++numberOfCalls === events.length) {
      done();
    }
  });

  ev.addEventListener(type, onMessage);
}

function mockChunks(...chunks: string[]) {
  const { writeChunk, endStream } = mockStreamedResponse();
  for (const chunk of chunks) {
    writeChunk(chunk);
  }
  endStream();
}

function mockStreamedResponse() {
  let writeChunk: (chunk: string) => void;
  let endStream: () => void;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      writeChunk = (chunk) => {
        controller.enqueue(encoder.encode(chunk));
      };
      endStream = () => controller.close();
    },
  });

  server.use(
    http.get('http://localhost/sse', () => {
      return new MswHttpResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
        },
      });
    }),
  );

  return {
    writeChunk: (s: string) => writeChunk(s),
    endStream: () => endStream(),
  };
}
