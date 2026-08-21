import { fetchCollection } from './utils/firebase.ts';
async function test() {
  const reqs = await fetchCollection('requests');
  console.log('Total requests in cloud:', reqs.length);
  let emptyCount = 0;
  for (const c of reqs) {
    if (!c || (!c.modelName?.toString().trim() && !c.requestCode?.toString().trim() && !c.customerName?.toString().trim())) {
      emptyCount++;
    }
  }
  console.log('Empty requests:', emptyCount);
}
test().catch(console.error);
