import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });

let visitorCount = 0;

wss.on('connection', (ws) => {
    visitorCount++;
    console.log(`New connection established. Current visitor count: ${visitorCount}`);

    // Send the current visitor count to the newly connected client
    ws.send(JSON.stringify({ type: 'visitorCount', count: visitorCount }));

    ws.on('close', () => {
        visitorCount--;
        console.log(`Connection closed. Current visitor count: ${visitorCount}`);
    });
});

export const getVisitorCount = () => visitorCount;