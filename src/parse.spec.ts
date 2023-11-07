import { getLines } from './parse';

describe('parse', () => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  describe('getLines', () => {
    function chunkEmitter(...chunks: string[]) {
      return async (onChunk: (chunk: Uint8Array) => Promise<void>) => {
        for (const chunk of chunks) {
          await onChunk(encoder.encode(chunk));
        }
      };
    }

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
          expect(fieldLength).toEqual(-1);
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

    it('line with no field', async () => {
      let lineNum = 0;
      const getLine = getLines();

      const chunks = chunkEmitter('this is an invalid line\n');
      await chunks(async (chunk) => {
        for await (const [line, fieldLength] of getLine(chunk)) {
          ++lineNum;
          expect(fieldLength).toEqual(-1);
          expect(decoder.decode(line)).toEqual('this is an invalid line');
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
});
