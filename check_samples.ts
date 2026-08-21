import { fetchCollection } from './utils/firebase';

async function test() {
  try {
    console.log("Fetching samples from Firestore...");
    const samples = await fetchCollection('samples');
    console.log(`Fetched ${samples.length} samples.`);
    if (samples.length > 0) {
      console.log("Sample 0:", samples[0].ma_so_mau || samples[0].id);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
