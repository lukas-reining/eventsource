export async function* readChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  let readResult = await reader.read();
  while (!readResult.done) {
    yield readResult.value;
    readResult = await reader.read();
  }
}

export function getLines() {
  let buffer: Uint8Array | undefined;
  let position: number; // current read position
  let fieldLength: number; // length of the `field` portion of the line
  let discardTrailingNewline = false;

  // return a function that can process each incoming byte chunk:
  return function* onChunk(
    arr: Uint8Array,
  ): Generator<[line: Uint8Array, fieldLength: number]> {
    if (buffer === undefined) {
      buffer = arr;
      position = 0;
      fieldLength = -1;
    } else {
      // we're still parsing the old line. Append the new bytes into buffer:
      buffer = concatBuffers(buffer, arr);
    }

    const bufLength = buffer.length;
    let lineStart = 0; // index where the current line starts
    while (position < bufLength) {
      if (discardTrailingNewline) {
        if (buffer[position] === ControlChars.NewLine) {
          lineStart = ++position; // skip to next char
        }

        discardTrailingNewline = false;
      }

      // start looking forward till the end of line:
      let lineEnd = -1; // index of the \r or \n char
      for (; position < bufLength && lineEnd === -1; ++position) {
        switch (buffer[position]) {
          case ControlChars.Colon:
            if (fieldLength === -1) {
              // first colon in line
              fieldLength = position - lineStart;
            }
            break;
          // @ts-ignore:7029 \r case below should fallthrough to \n:
          case ControlChars.CarriageReturn:
            discardTrailingNewline = true;
          case ControlChars.NewLine:
            lineEnd = position;
            break;
        }
      }

      if (lineEnd === -1) {
        // We reached the end of the buffer but the line hasn't ended.
        // Wait for the next arr and then continue parsing:
        break;
      }

      // we've reached the line end, send it out:
      yield [buffer.subarray(lineStart, lineEnd), fieldLength];
      lineStart = position; // we're now on the next line
      fieldLength = -1;
    }

    if (lineStart === bufLength) {
      buffer = undefined; // we've finished reading it
    } else if (lineStart !== 0) {
      // Create a new view into buffer beginning at lineStart so we don't
      // need to copy over the previous lines when we get the new arr:
      buffer = buffer.subarray(lineStart);
      position -= lineStart;
    }
  };
}

export function getMessages() {
  let message = createMessage();
  const decoder = new TextDecoder();

  // return a function that can process each incoming line buffer:
  return function* onLine(
    line: Uint8Array,
    fieldLength: number,
  ): Generator<[message?: EventSourceMessage, id?: string, retry?: number]> {
    const isEndOfMessage = line.length === 0;
    if (isEndOfMessage) {
      yield [message];
      message = createMessage();
    } else if (fieldLength > 0) {
      // exclude comments and lines with no values
      // line is of format "<field>:<value>" or "<field>: <value>"
      // https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
      const field = decoder.decode(line.subarray(0, fieldLength));
      const valueOffset =
        fieldLength + (line[fieldLength + 1] === ControlChars.Space ? 2 : 1);
      const value = decoder.decode(line.subarray(valueOffset));

      switch (field) {
        case 'data':
          // if this message already has data, append the new value to the old.
          // otherwise, just set to the new value:
          message.data = message.data ? message.data + '\n' + value : value; // otherwise,
          break;
        case 'event':
          message.event = value;
          break;
        case 'id':
          message.id = value;
          yield [undefined, value, undefined];
          break;
        case 'retry':
          const retry = parseInt(value, 10);
          if (!isNaN(retry)) {
            // per spec, ignore non-integers
            message.retry = retry;
            yield [undefined, undefined, retry];
          }
          break;
      }
    }
  };
}

const enum ControlChars {
  NewLine = 10,
  CarriageReturn = 13,
  Space = 32,
  Colon = 58,
}

function concatBuffers(a: Uint8Array, b: Uint8Array) {
  const res = new Uint8Array(a.length + b.length);
  res.set(a);
  res.set(b, a.length);
  return res;
}

function createMessage(): EventSourceMessage {
  return {
    data: '',
    event: '',
    id: '',
    retry: undefined,
  };
}

export interface EventSourceMessage {
  /** The event ID to set the EventSource object's last event ID value. */
  id: string;
  /** A string identifying the type of event described. */
  event: string;
  /** The event data */
  data: string;
  /** The reconnection interval (in milliseconds) to wait before retrying the connection */
  retry?: number;
}
