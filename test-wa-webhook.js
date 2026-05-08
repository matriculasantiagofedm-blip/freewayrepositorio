const payload = {
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "1234567890",
          "phone_number_id": "1045621595304134"
        },
        "contacts": [{
          "profile": {
            "name": "Test User WA"
          },
          "wa_id": "50761234567"
        }],
        "messages": [{
          "from": "50761234567",
          "id": "wamid.HBg1MDc2MTIzNDU2NxVBSkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB",
          "timestamp": "1694539820",
          "text": {
            "body": "Hola, quiero información del curso Práctico por favor."
          },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
};

async function testWAWebhook() {
  const res = await fetch('http://localhost:9002/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}

testWAWebhook().catch(console.error);
