import { EventSource } from 'extended-eventsource';

async function main() {
  const eventsource = new EventSource('http://localhost:8080/sse');
  eventsource.onmessage = (msg) => {
    console.log('onmessage', msg, msg.data);
  };
  eventsource.addEventListener('server-time', (msg) => {
    console.log('server-timestamp', msg, msg.lastEventId, msg.data, msg.origin);
  });
  setTimeout(eventsource.close, 3000);
}

main();
