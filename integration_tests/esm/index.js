import assert from 'node:assert';
import { newServer } from 'mock-xmlhttprequest';

function functionToTest() {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/my/url');
    xhr.onload = () => resolve(JSON.parse(xhr.response));
    xhr.onerror = () => reject(xhr.statusText);
    xhr.send();
  });
}

const server = newServer({
  get: ['/my/url', {
    headers: { 'Content-Type': 'application/json' },
    body: '{ "message": "Success!" }',
  }],
});

async function integrationTest() {
  try {
    server.install();
    const result = await functionToTest();
    assert.strictEqual(result.message, 'Success!');
  } finally {
    server.remove();
  }
}

integrationTest();
