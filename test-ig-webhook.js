const payload = {
  "object": "instagram",
  "entry": [
    {
      "id": "1234567890",
      "time": 1569262486134,
      "messaging": [
        {
          "sender": { "id": "999888777" },
          "recipient": { "id": "1234567890" },
          "timestamp": 1569262485349,
          "message": {
            "mid": "mid.12345",
            "text": "Mensaje de prueba desde IG x2"
          }
        }
      ]
    }
  ]
};

async function testIGWebhook() {
  const res = await fetch('http://localhost:9002/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}

testIGWebhook().catch(console.error);
