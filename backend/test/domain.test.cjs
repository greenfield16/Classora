require('../../core/test/domain.cjs').register(
  require('../src/exams/docx-parser').parseDocxBuffer,
  require('../src/exams/scoring').scoreTrueFalse,
  require('adm-zip'),
);
