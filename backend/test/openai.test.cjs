const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {callOpenAI} = require('../src/common/openai');

test('server adapters match and handle OpenAI text, images and failures without leaking keys', async () => {
  assert.equal(fs.readFileSync('src/common/openai.ts','utf8'), fs.readFileSync('../functions/src/openai.ts','utf8'));
  const oldFetch = global.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  let calls = 0;
  try {
    delete process.env.OPENAI_API_KEY;
    global.fetch = async () => { calls++; throw Error('must not call'); };
    await assert.rejects(callOpenAI({prompt:'test'}), /OPENAI_API_KEY/);
    assert.equal(calls,0);
    process.env.OPENAI_API_KEY = 'synthetic-unit-test';
    global.fetch = async (url, opts) => {
      assert.equal(url,'https://api.openai.com/v1/responses');
      assert.equal(opts.headers.Authorization,'Bearer synthetic-unit-test');
      const body = JSON.parse(opts.body);
      assert.equal(body.store,false);
      assert.equal(body.model,'gpt-4.1-mini');
      assert.equal(body.text.format.type,'json_object');
      assert.equal(body.input[0].content[1].image_url,'data:image/png;base64,c3ludGhldGlj');
      return {ok:true,json:async()=>({status:'completed',model:'provider-model',output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]})};
    };
    assert.deepEqual(await callOpenAI({prompt:'Return JSON',responseJson:true,imagesBase64:[{mimeType:'image/png',data:'c3ludGhldGlj'}]}),{text:'{"ok":true}',model:'provider-model'});
    await assert.rejects(callOpenAI({prompt:'test',imagesBase64:[{mimeType:'text/html',data:'test'}]}), /Unsupported image/);
    global.fetch = async()=>({ok:false,status:401,text:async()=> 'synthetic-unit-test'});
    await assert.rejects(callOpenAI({prompt:'test'}), e=>e.message==='OpenAI request failed (HTTP 401).');
    for (const data of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]}]) {
      global.fetch = async()=>({ok:true,json:async()=>data});
      await assert.rejects(callOpenAI({prompt:'test'}), /did not complete|no text/);
    }
  } finally {
    global.fetch = oldFetch;
    if (oldKey===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=oldKey;
  }
});
