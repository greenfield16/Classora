const {parseDocxBuffer,scoreTrueFalse}=require('../dist');
require('./domain.cjs').register(parseDocxBuffer,scoreTrueFalse,require('adm-zip'));
