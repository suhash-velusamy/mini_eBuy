const STOPWORDS = new Set([
  'the',
  'is',
  'at',
  'which',
  'on',
  'a',
  'an',
  'this',
  'that',
  'with',
  'for',
  'of',
  'and',
  'or',
  'in',
  'to',
  'do',
  'does',
  'did',
  'can',
  'could',
  'you',
  'i',
  'it',
  'have',
  'has',
  'how',
  'what',
  'when',
  'where',
  'why',
  'who',
  'please',
  'any',
  'my',
  'your',
  'are',
  'be',
  'will',
  'would',
  'there',
  'item',
  'sir',
  'mam',
  'bro',
]);

/**
 * Normalizes text and returns unique keyword tokens.
 */
function tokenizeAndNormalize(text) {
  if (!text) return [];
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .trim();
  const words = clean.split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * Computes Token Jaccard Similarity between two token lists.
 * Returns a float between 0.0 and 1.0.
 */
function computeJaccardSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0.0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  if (unionSize === 0) return 0.0;

  return intersectionCount / unionSize;
}

/**
 * Checks an item's questions for duplicates (Jaccard similarity >= 0.7).
 */
async function findDuplicateQuestion(itemId, rawText, QuestionModel, excludeQuestionId = null) {
  const newTokens = tokenizeAndNormalize(rawText);
  if (newTokens.length === 0) return null;

  const existingQuestions = await QuestionModel.find({
    item: itemId,
    status: { $ne: 'hidden' },
    ...(excludeQuestionId ? { _id: { $ne: excludeQuestionId } } : {}),
  }).populate('asker', 'name');

  for (const q of existingQuestions) {
    const existingTokens = tokenizeAndNormalize(q.text);
    const similarity = computeJaccardSimilarity(newTokens, existingTokens);
    if (similarity >= 0.7) {
      return {
        matchedQuestion: q,
        similarity: Math.round(similarity * 100) / 100,
      };
    }
  }

  return null;
}

module.exports = {
  tokenizeAndNormalize,
  computeJaccardSimilarity,
  findDuplicateQuestion,
};

