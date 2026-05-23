const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunctionBody(name) {
  const marker = `async function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(braceStart + 1, end - 1);
}

test('OpenAI auto-run stage 1 skips completed open-chatgpt before executing', () => {
  const body = extractFunctionBody('runAutoSequenceFromNodeGraph');
  const step1BlockStart = body.indexOf("if (await shouldRunNamedNode('open-chatgpt'))");
  assert.notEqual(step1BlockStart, -1, 'missing open-chatgpt stage 1 block');

  const executeStart = body.indexOf("executeNodeAndWaitWithAutoRunIdleLogWatchdog('open-chatgpt'", step1BlockStart);
  assert.notEqual(executeStart, -1, 'missing open-chatgpt execution call');

  const guardSnippet = body.slice(step1BlockStart, executeStart);
  assert.match(guardSnippet, /getNodeStatusForNode\(latestState, 'open-chatgpt'\)/);
  assert.match(guardSnippet, /isStepDoneStatus\(openChatgptStatus\)/);
});

test('OpenAI auto-run stage 1 skips completed submit-signup-email before email preparation', () => {
  const body = extractFunctionBody('runAutoSequenceFromNodeGraph');
  const step2BlockStart = body.indexOf("if (await shouldRunNamedNode('submit-signup-email'))");
  assert.notEqual(step2BlockStart, -1, 'missing submit-signup-email stage 1 block');

  const prepareEmailStart = body.indexOf('ensureAutoEmailReady(targetRun, totalRuns, attemptRuns)', step2BlockStart);
  assert.notEqual(prepareEmailStart, -1, 'missing submit-signup-email email preparation call');

  const guardSnippet = body.slice(step2BlockStart, prepareEmailStart);
  assert.match(guardSnippet, /getNodeStatusForNode\(latestState, 'submit-signup-email'\)/);
  assert.match(guardSnippet, /isStepDoneStatus\(submitSignupEmailStatus\)/);
});
