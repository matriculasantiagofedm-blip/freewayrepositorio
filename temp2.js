const fs = require('fs');
let code = fs.readFileSync('src/components/forms/deluxe-contract-form.tsx', 'utf8');

// Fix Zod enum duplicate
code = code.replace(/theoreticalClassSchedule: z.enum\(\['Jueves 7:00 pm a 9:00 pm', 'Jueves 7:00 pm a 9:00 pm'\]\)/g, 'theoreticalClassSchedule: z.enum([\\'Jueves 7:00 pm a 9:00 pm\\'])');

// Moto section rendering bypass
code = code.replace(/watchAdditionalService !== 'Ninguno'/g, 'false');

fs.writeFileSync('src/components/forms/deluxe-contract-form.tsx', code);
