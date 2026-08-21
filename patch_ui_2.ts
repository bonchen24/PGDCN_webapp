import fs from 'fs';

let content = fs.readFileSync('components/SystemManagementViews.tsx', 'utf-8');

// 1. Add uploadConfirmOpen state
content = content.replace(
  'const [restoreConfirmData, setRestoreConfirmData] = useState<any>(null);',
  `const [restoreConfirmData, setRestoreConfirmData] = useState<any>(null);\n  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);`
);

// We need to import CloudUpload if not imported
if (!content.includes('CloudUpload,')) {
    content = content.replace('Upload,', 'Upload, CloudUpload,');
}

fs.writeFileSync('components/SystemManagementViews.tsx', content);
