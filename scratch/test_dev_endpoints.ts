async function testDevHttp() {
  console.log('Testing HTTP /api/intent on Vite server...');
  const res = await fetch('http://127.0.0.1:3000/api/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '下载 Blender 4.2' })
  });
  console.log('HTTP Status:', res.status);
  const data = await res.json();
  console.log('Intent response:', data);

  console.log('\nTesting HTTP /api/composer on Vite server...');
  const res2 = await fetch('http://127.0.0.1:3000/api/composer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Photoshop',
      intentAnalysis: data
    })
  });
  console.log('HTTP Status:', res2.status);
  const data2 = await res2.json();
  console.log('Composer Blueprint title:', data2.title, 'Components:', data2.components?.length);
}

testDevHttp().catch(err => {
  console.error(err);
  process.exit(1);
});
