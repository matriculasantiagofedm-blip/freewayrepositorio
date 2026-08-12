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
    content = content.replace(/\n*export function generateStaticParams\(\) \{ return \[\{ id: 'demo' \}\]; \}\n*/g, '\n');
    fs.writeFileSync(file, content);
    console.log('Cleaned up generateStaticParams from:', file);
  }
});
