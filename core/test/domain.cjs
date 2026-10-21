const { test } = require('node:test');
const assert = require('node:assert/strict');
let AdmZip;
function fixture() {
  const paragraphs = [
    ['PHẦN I. Trắc nghiệm'], ['Câu 1. Tổng của 2 và 3?'], ['A. 4'], ['B. 5', true], ['C. 6'], ['D. 7'],
    ['PHẦN II. Đúng sai'], ['Câu 2. Các số tự nhiên'], ['a) 2 là số chẵn', true], ['b) 3 là số chẵn'], ['c) 4 lớn hơn 1', true], ['d) 0 lớn hơn 5'],
    ['PHẦN III. Trả lời ngắn'], ['Câu 3. 6 nhân 7 bằng bao nhiêu?'], ['Đáp án: 42']
  ];
  const zip = new AdmZip();
  const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs.map(([s,u]) => `<w:p><w:r>${u?'<w:rPr><w:u w:val="single"/></w:rPr>':''}<w:t>${s}</w:t></w:r></w:p>`).join('') + '</w:body></w:document>';
  zip.addFile('word/document.xml', Buffer.from(xml));
  return zip.toBuffer();
}
function register(parseDocxBuffer, scoreTrueFalse, Zip) {
  AdmZip = Zip;
  test('synthetic DOCX imports all three question types and answer markings', async () => {
    const q = await parseDocxBuffer(fixture());
    assert.equal(q.length,3); assert.equal(q[0].correctAnswer,'B'); assert.equal(q[0].options.length,4);
    assert.deepEqual(q[1].statements.map(s=>s.answer),[true,false,true,false]);
    assert.equal(q[2].shortAnswer,'42'); assert.match(q[2].content,/6 nhân 7/);
  });
  test('rejects a ZIP without document XML and a malformed document', async () => {
    const zip = new AdmZip(); zip.addFile('other.txt',Buffer.from('synthetic'));
    await assert.rejects(parseDocxBuffer(zip.toBuffer()), /document.xml/);
    zip.addFile('word/document.xml',Buffer.from('<broken'));
    await assert.rejects(parseDocxBuffer(zip.toBuffer()));
  });
  test('true/false grading respects every configured score tier', () => {
    const scoring = {correct1:.1,correct2:.25,correct3:.5,correct4:1};
    for(let n=0;n<=4;n++) assert.equal(scoreTrueFalse(Array.from({length:4},(_,i)=>i<n),[true,true,true,true],scoring),[0,.1,.25,.5,1][n]);
    assert.equal(scoreTrueFalse([], [true,false,true,false], scoring),0);
    assert.equal(scoreTrueFalse([false], [false,true,true,true], scoring),.1);
  });
}
module.exports = {register,fixture};
