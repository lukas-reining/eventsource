import { getLines, getMessages } from './parse';

describe('parse', () => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function chunkEmitter(...chunks: string[]) {
    return async (onChunk: (chunk: Uint8Array) => Promise<void>) => {
      for (const chunk of chunks) {
        await onChunk(encoder.encode(chunk));
      }
    };
  }

  describe('getLines', () => {
    it('single line', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('id: abc\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;
          expect(decoder.decode(line)).toEqual('id: abc');
          expect(fieldLength).toEqual(2);
        }
      });

      expect(lineNum).toBe(1);
    });

    it('multiple lines', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('id: abc\n', 'data: def\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;
          if (lineNum === 1) {
            expect(decoder.decode(line)).toEqual('id: abc');
            expect(fieldLength).toEqual(2);
          } else {
            expect(decoder.decode(line)).toEqual('data: def');
            expect(fieldLength).toEqual(4);
          }
        }
      });

      expect(lineNum).toBe(2);
    });

    it('single line split across multiple chunks', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('id: a', 'bc\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;
          expect(decoder.decode(line)).toEqual('id: abc');
          expect(fieldLength).toEqual(2);
        }
      });

      expect(lineNum).toBe(1);
    });

    it('multiple lines split across multiple chunks', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('id: ab', 'c\nda', 'ta: def\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;

          if (lineNum === 1) {
            expect(decoder.decode(line)).toEqual('id: abc');
            expect(fieldLength).toEqual(2);
          } else {
            expect(decoder.decode(line)).toEqual('data: def');
            expect(fieldLength).toEqual(4);
          }
        }
      });

      expect(lineNum).toBe(2);
    });

    it('new line', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;
          expect(fieldLength).toEqual(0);
          expect(decoder.decode(line)).toEqual('');
        }
      });

      expect(lineNum).toBe(1);
    });

    it('comment line', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter(': this is a comment\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;
          expect(fieldLength).toEqual(0);
          expect(decoder.decode(line)).toEqual(': this is a comment');
        }
      });

      expect(lineNum).toBe(1);
    });

    it('line with multiple colons', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('id: abc: def\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;
          expect(fieldLength).toEqual(2);
          expect(decoder.decode(line)).toEqual('id: abc: def');
        }
      });

      expect(lineNum).toBe(1);
    });

    it('single byte array with multiple lines separated by \\n', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('id: abc\ndata: def\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;

          if (lineNum === 1) {
            expect(fieldLength).toEqual(2);
            expect(decoder.decode(line)).toEqual('id: abc');
          } else {
            expect(fieldLength).toEqual(4);
            expect(decoder.decode(line)).toEqual('data: def');
          }
        }
      });

      expect(lineNum).toBe(2);
    });

    it('single byte array with multiple lines separated by \\r', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('id: abc\rdata: def\r');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;

          if (lineNum === 1) {
            expect(fieldLength).toEqual(2);
            expect(decoder.decode(line)).toEqual('id: abc');
          } else {
            expect(fieldLength).toEqual(4);
            expect(decoder.decode(line)).toEqual('data: def');
          }
        }
      });

      expect(lineNum).toBe(2);
    });

    it('single byte array with multiple lines separated by \\r\\n', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('id: abc\r\ndata: def\r\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;

          if (lineNum === 1) {
            expect(fieldLength).toEqual(2);
            expect(decoder.decode(line)).toEqual('id: abc');
          } else {
            expect(fieldLength).toEqual(4);
            expect(decoder.decode(line)).toEqual('data: def');
          }
        }
      });

      expect(lineNum).toBe(2);
    });
  });

  describe('getMessages', () => {
    function lineEmitter(...lines: string[]) {
      return async (
        onLine: (onLine: Uint8Array, fieldLength: number) => Promise<void>,
      ) => {
        for (const line of lines) {
          const colonIndex = line.indexOf(':');
          await onLine(
            encoder.encode(line),
            colonIndex !== -1 ? colonIndex : line.length,
          );
        }
      };
    }

    it('decode a message with all its properties', async () => {
      const getMessage = getMessages();
      const chunks = lineEmitter(
        'retry: 42',
        'id: abc',
        'event:def',
        'data:ghi',
        '',
      );

      let lineNum = 0;
      await chunks(async (line, fieldLength) => {
        for await (const [message, id, retry] of getMessage(
          line,
          fieldLength,
        )) {
          ++lineNum;

          switch (lineNum) {
            case 1:
              expect(retry).toEqual(42);
              expect(id).toEqual(undefined);
              expect(message).toEqual(undefined);
              break;
            case 2:
              expect(retry).toEqual(undefined);
              expect(id).toEqual('abc');
              expect(message).toEqual(undefined);
              break;
            case 3:
              expect(retry).toEqual(undefined);
              expect(id).toEqual(undefined);
              expect(message).toEqual({
                data: 'ghi',
                event: 'def',
                id: 'abc',
                retry: 42,
              });
              break;
            case 4:
              fail('Should never get here');
          }
        }
      });
    });

    it('skip unknown fields', async () => {
      const getMessage = getMessages();
      const chunks = lineEmitter('id: abc', 'foo:def', '');

      let lineNum = 0;
      await chunks(async (line, fieldLength) => {
        for await (const [message, id, retry] of getMessage(
          line,
          fieldLength,
        )) {
          ++lineNum;

          switch (lineNum) {
            case 1:
              expect(retry).toEqual(undefined);
              expect(id).toEqual('abc');
              expect(message).toEqual(undefined);
              break;
            case 2:
              expect(retry).toEqual(undefined);
              expect(id).toEqual(undefined);
              expect(message).toEqual({
                id: 'abc',
                data: '',
                event: '',
                retry: undefined,
              });
              break;
            default:
              fail('Should never get here');
          }
        }
      });
    });

    it('ignore non-integer retry', async () => {
      const getMessage = getMessages();
      const chunks = lineEmitter('retry: def', '');

      let lineNum = 0;
      await chunks(async (line, fieldLength) => {
        for await (const [message, id, retry] of getMessage(
          line,
          fieldLength,
        )) {
          ++lineNum;

          switch (lineNum) {
            case 1:
              expect(retry).toEqual(undefined);
              expect(id).toEqual(undefined);
              expect(message).toEqual({
                id: '',
                data: '',
                event: '',
                retry: undefined,
              });
              break;
            default:
              fail('Should never get here');
          }
        }
      });
    });

    it('skip comment-only messages', async () => {
      const getMessage = getMessages();
      const chunks = lineEmitter('id:123', ':', ':     ', 'event: foo  ', '');

      let lineNum = 0;
      await chunks(async (line, fieldLength) => {
        for await (const [message, id, retry] of getMessage(
          line,
          fieldLength,
        )) {
          ++lineNum;

          switch (lineNum) {
            case 1:
              expect(retry).toEqual(undefined);
              expect(id).toEqual('123');
              expect(message).toEqual(undefined);
              break;
            case 2:
              expect(retry).toEqual(undefined);
              expect(id).toEqual(undefined);
              expect(message).toEqual({
                id: '123',
                data: '',
                event: 'foo  ',
                retry: undefined,
              });
              break;
            default:
              fail('Should never get here');
          }
        }
      });
    });

    it('should append data split across multiple lines', async () => {
      const getMessage = getMessages();
      const chunks = lineEmitter(
        'data:YHOO',
        'data: +2',
        'data',
        'data: 10',
        '',
      );

      let lineNum = 0;
      await chunks(async (line, fieldLength) => {
        for await (const [message, id, retry] of getMessage(
          line,
          fieldLength,
        )) {
          ++lineNum;

          switch (lineNum) {
            case 1:
              expect(retry).toEqual(undefined);
              expect(id).toEqual(undefined);
              expect(message).toEqual({
                id: '',
                data: 'YHOO\n+2\n\n10',
                event: '',
                retry: undefined,
              });
              break;
            default:
              fail('Should never get here');
          }
        }
      });
    });

    it('should reset id if sent multiple times', async () => {
      const getMessage = getMessages();
      const chunks = lineEmitter('id:foo', 'id', '');

      let lineNum = 0;
      await chunks(async (line, fieldLength) => {
        for await (const [message, id, retry] of getMessage(
          line,
          fieldLength,
        )) {
          ++lineNum;

          switch (lineNum) {
            case 1:
              expect(retry).toEqual(undefined);
              expect(id).toEqual('foo');
              expect(message).toEqual(undefined);
              break;
            case 2:
              expect(retry).toEqual(undefined);
              expect(id).toEqual('');
              expect(message).toEqual(undefined);
              break;
            case 3:
              expect(retry).toEqual(undefined);
              expect(id).toEqual(undefined);
              expect(message).toEqual({
                id: '',
                data: '',
                event: '',
                retry: undefined,
              });
              break;
            default:
              fail('Should never get here');
          }
        }
      });
    });
  });

  describe('integration of getLines and getMessages', () => {
    it('parses complex messages correct', async () => {
      let messageNum = 0;
      const getLine = getLines();
      const getMessage = getMessages();

      const chunks = chunkEmitter(
        'id:foo\n',
        'id:',
        'bar\n',
        'data:YHOO\n',
        'event: test\n',
        'event: custom\n',
        'data: +2\n',
        ':\n',
        'data\n',
        'retry: 50\n',
        'data: 10\n',
        '\n',
      );

      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          for await (const [message, id, retry] of getMessage(
            line,
            fieldLength,
          )) {
            ++messageNum;
            switch (messageNum) {
              case 1:
                expect(retry).toEqual(undefined);
                expect(id).toEqual('foo');
                expect(message).toEqual(undefined);
                break;
              case 2:
                expect(retry).toEqual(undefined);
                expect(id).toEqual('bar');
                expect(message).toEqual(undefined);
                break;
              case 3:
                expect(retry).toEqual(50);
                expect(id).toEqual(undefined);
                expect(message).toEqual(undefined);
                break;
              case 4:
                expect(retry).toEqual(undefined);
                expect(id).toEqual(undefined);
                expect(message).toEqual({
                  data: 'YHOO\n+2\n\n10',
                  event: 'custom',
                  id: 'bar',
                  retry: 50,
                });
                break;
              default:
                fail('Should never get here');
            }
          }
        }
      });
    });
  });
});
