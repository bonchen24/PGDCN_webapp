import { fetchCollection } from './utils/firebase.ts';
async function test() {
  const reqs = await fetchCollection('requests');
  console.log('Total requests in cloud:', reqs.length);
}
test().catch(console.error);
