const dotenv = require('dotenv');
dotenv.config({ path: 'd:/FirebaseProjects/contracttime3-15048626-b65e6/.env' });

const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

async function getAccessToken() {
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    if (!res.ok) {
        throw new Error(`Error obteniendo token: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.access_token;
}

async function fetchTransactions() {
    console.log("Obteniendo access token de PayPal Live...");
    const token = await getAccessToken();
    console.log("Token obtenido exitosamente. Consultando transacciones recientes en PayPal Live...\n");

    const startDate = '2026-07-24T00:00:00Z';
    const endDate = new Date().toISOString();

    const url = `${PAYPAL_BASE}/v1/reporting/transactions?start_date=${startDate}&end_date=${endDate}&fields=all&page_size=100`;

    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) {
        console.error(`Error consultando transacciones de PayPal: ${res.status}`);
        const errText = await res.text();
        console.error(errText);
        return;
    }

    const data = await res.json();
    console.log(`\n======================================================`);
    console.log(`  TRANSACCIONES PAYPAL LIVE (${data.transaction_details?.length || 0} encontradas)`);
    console.log(`======================================================`);

    if (!data.transaction_details || data.transaction_details.length === 0) {
        console.log("No se encontraron transacciones en el rango especificado.");
        return;
    }

    data.transaction_details.forEach((t, idx) => {
        const info = t.transaction_info || {};
        const payer = t.payer_info || {};
        const cart = t.cart_info || {};

        console.log(`\n${idx + 1}. [TRANSACCIÓN PAYPAL #${info.transaction_id || 'N/A'}]`);
        console.log(`   Fecha: ${info.transaction_initiation_date}`);
        console.log(`   Estado: ${info.transaction_status}`);
        console.log(`   Monto: $${info.transaction_amount?.value} ${info.transaction_amount?.currency_code}`);
        console.log(`   Cliente: ${payer.payer_name?.given_name || ''} ${payer.payer_name?.surname || ''}`);
        console.log(`   Email Cliente: ${payer.email_address || 'N/A'}`);
        console.log(`   Teléfono: ${payer.phone_number?.national_number || 'N/A'}`);
        console.log(`   Descripción/Nota: ${info.transaction_subject || info.custom_field || 'N/A'}`);
        console.log(`------------------------------------------------------`);
    });
}

fetchTransactions().catch(console.error);
