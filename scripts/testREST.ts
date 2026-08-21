import AppletConfig from '../firebase-applet-config.json' assert { type: "json" };

async function testREST() {
  const projectId = AppletConfig.projectId;
  const dbId = AppletConfig.firestoreDatabaseId;
  const apiKey = AppletConfig.apiKey;
  
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/customers?key=${apiKey}&pageSize=5`;
  
  console.log("Fetching:", url);
  const res = await fetch(url, {
    headers: {
      'Origin': 'http://localhost:5173',
      'Referer': 'http://localhost:5173/'
    }
  });
  
  console.log("Status:", res.status);
  const data = await res.text();
  console.log("Response:", data.substring(0, 500));
}

testREST();
