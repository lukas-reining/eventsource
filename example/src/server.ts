import express from 'express';
import serveStatic from 'serve-static';
import SseStream from 'ssestream';

const app = express();
app.use(serveStatic(__dirname));
app.get('/sse', async (req, res) => {
  const lastEventId = req.header('Last-Event-ID');
  const eventsString = req.query.events;
  const events = eventsString ? parseInt(eventsString as string, 10) : undefined;

  const sseStream = new SseStream(req);
  sseStream.pipe(res);

  const writeMessage = (id: string) => {
    sseStream.write({
      id: id,
      event: 'server-time',
      data: new Date().toTimeString(),
    });
  };

  if (events) {
    for (let event = 0; event < events; event++) {
      writeMessage(event.toString(10));
    }
    sseStream.unpipe(res);
    res.end();
  } else {
    let id = lastEventId ? parseInt(lastEventId, 10): 0;
    const pusher = setInterval(() => {
      writeMessage(id.toString(10));
      id++;
    }, 1000);

    res.on('close', () => {
      clearInterval(pusher);
      sseStream.unpipe(res);
    });
  }

});

app.listen(8080, () => {
  console.log('server ready on http://localhost:8080');
});
