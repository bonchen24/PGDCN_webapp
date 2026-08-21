async function testURL(url) {
  try {
    const resp = await fetch(url + '?action=getAll');
    const json = await resp.json();
    console.log(url, "requests:", json.data?.requests?.length);
  } catch(e) { console.log(url, e.message) }
}
testURL('https://script.google.com/macros/s/AKfycbzVWCpquFfG7HD2a1CoPGid9NBYSV7l1I53PZErdlzbL9lq_Cu7ooTxZDk43EoIKH-3VA/exec');
testURL('https://script.google.com/macros/s/AKfycby2J4qjDGKKhZRKgZuvazut-JrZIjdhEChlJWXzd2bhJlSZroN4IGz5QiuB4Gj-tnMurg/exec');
