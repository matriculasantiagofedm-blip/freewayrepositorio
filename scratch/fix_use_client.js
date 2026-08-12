const fs = require('fs');

const targetFiles = [
  'd:/FirebaseProjects/contracttime3-15048626-b65e6/src/app/certificate-print/[id]/page.tsx',
  'd:/FirebaseProjects/contracttime3-15048626-b65e6/src/app/(app)/clients/[id]/page.tsx',
  'd:/FirebaseProjects/contracttime3-15048626-b65e6/src/app/(app)/contracts/[id]/page.tsx',
  'd:/FirebaseProjects/contracttime3-15048626-b65e6/src/app/(app)/contracts/[id]/edit/page.tsx',
  'd:/FirebaseProjects/contracttime3-15048626-b65e6/src/app/print-contract/[id]/page.tsx',
  'd:/FirebaseProjects/contracttime3-15048626-b65e6/src/app/print-exam/[id]/page.tsx',
  'd:/FirebaseProjects/contracttime3-15048626-b65e6/src/app/print-log/[id]/page.tsx'
];

targetFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Remove any top generateStaticParams
    content = content.replace(/^export function generateStaticParams\(\) \{ return \[\{ id: 'demo' \}\]; \}\n/, '');

    // Ensure 'use client'; is line 1
    if (!content.trim().startsWith("'use client';")) {
      content = "'use client';\n" + content.replace(/'use client';\n?/g, '');
    }

    // Append generateStaticParams at bottom
    if (!content.includes('generateStaticParams')) {
      content = content + "\n\nexport function generateStaticParams() { return [{ id: 'demo' }]; }\n";
    }

    fs.writeFileSync(file, content);
    console.log('Fixed use client order for:', file);
  }
});
