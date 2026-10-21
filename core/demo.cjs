const { scoreTrueFalse } = require('./dist');
console.log(JSON.stringify({scenario:'Two of four statements correct',score:scoreTrueFalse([true,true,false,false],[true,true,true,true],{correct1:.1,correct2:.25,correct3:.5,correct4:1})},null,2));
