const fs = require('fs');

let code = fs.readFileSync('src/components/forms/deluxe-contract-form.tsx', 'utf8');

// Replacements
code = code.replace(/AutoContractForm/g, 'DeluxeContractForm');
code = code.replace(/autoContractSchema/g, 'deluxeContractSchema');
code = code.replace(/autoMotoDetails/g, 'deluxeDetails');

code = code.replace(/const DEFAULT_AUTO_PRICES[^]+?};/m, 'const DEFAULT_DELUXE_PRICES: Record<string, number> = {\n  "Paquete Deluxe (Edición Especial)": 270.00\n};');
code = code.replace(/const PLAN_PRACTICAL_COUNTS[^]+?};/m, 'const PLAN_PRACTICAL_COUNTS: Record<string, number> = {\n  "Paquete Deluxe (Edición Especial)": 8\n};');

code = code.replace(/enum\(\[\'Sabados 3:00 pm a 5:00 pm\', \'Semanal 8:00 am a 10:00 am\'\]\)/g, 'enum([\'Jueves 7:00 pm a 9:00 pm\'])');
code = code.replace(/Sabados 3:00 pm a 5:00 pm/g, 'Jueves 7:00 pm a 9:00 pm');
code = code.replace(/Semanal 8:00 am a 10:00 am/g, 'Jueves 7:00 pm a 9:00 pm');

code = code.replace(/DEFAULT_AUTO_PRICES/g, 'DEFAULT_DELUXE_PRICES');
code = code.replace(/settingsPrices\?.auto/g, 'settingsPrices?.deluxe');

// Default initial selection
code = code.replace(/coursePlan: \'\'/, 'coursePlan: \'Paquete Deluxe (Edición Especial)\'');
code = code.replace(/theoreticalClassSchedule: \'Jueves 7:00 pm a 9:00 pm\',/, 'theoreticalClassSchedule: \'Jueves 7:00 pm a 9:00 pm\',');

// Fix infinite loop
code = code.replace(/const planPrices = \{ \.\.\.DEFAULT_DELUXE_PRICES, \.\.\.\(settingsPrices\?\.deluxe \|\| \{\}\) \};/, 'const planPrices = useMemo(() => ({ ...DEFAULT_DELUXE_PRICES, ...(settingsPrices?.deluxe || {}) }), [settingsPrices?.deluxe]);');


// Fix title
code = code.replace(/CURSO DE AUTO \(SINCRONIZADO CON AGENDA\)/g, 'PAQUETE DELUXE');

fs.writeFileSync('src/components/forms/deluxe-contract-form.tsx', code);
