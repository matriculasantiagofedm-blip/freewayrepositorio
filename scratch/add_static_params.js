const fs = require('fs');
const path = require('path');

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
    if (!content.includes('generateStaticParams')) {
      content = "export function generateStaticParams() { return [{ id: 'demo' }]; }\n" + content;
      fs.writeFileSync(file, content);
      console.log('Added generateStaticParams to:', file);
    }
  }
});
