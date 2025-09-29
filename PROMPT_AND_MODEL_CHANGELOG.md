# Prompt and Model Changelog

This document tracks the evolution of prompts and AI models used in the Emir app's summary generation feature over time.

## Summary Generation API (`/api/summarize`)

### Current Configuration (September 29, 2025)
- **Model**: `gemini-2.0-flash-001`
- **Max Tokens**: 300 (allows ~200-250 words)
- **Temperature**: 0.7
- **Prompt Version**: v4.0 (Critical First Person)

### Prompt Evolution

#### v1.0 - Initial Prompt (Early 2025)
```javascript
const prompt = `Provide a brief, empathetic 50-word reflection on this personal sharing. Focus on key insights and emotional themes with warmth and understanding:\n\n${transcript}`
```
- **Max Tokens**: 80 (limited to ~50 words)
- **Focus**: Empathetic reflection with warmth
- **Issues**: Too short, not first person

#### v2.0 - First Person Focus (July 2025)
```javascript
const prompt = `Provide a brief paraphrased summary of this personal share. You are a simple and attentive active listener. Do not provide praise, disapproval or commentary of any sort. Capture the main points and feelings expressed. Be specific and avoid generic statements. The summary should make the listener feel heard, without any judgement and without any words that even slightly could be received as judgement. The paraphrase should be different than the speech provided, and be in first person tense. Paraphrase the text regardless of length, language or speaking style.\n\n${transcript}`
```
- **Max Tokens**: 80 (still limited)
- **Focus**: First person, non-judgmental
- **Issues**: Still too short, some grammatical errors

#### v3.0 - Improved Structure (August 26, 2025)
```javascript
const prompt = `You are a simple and attentive active listener. 
                Rephrase this personal reflection in first person. 
                Use "I" statements. 
                Do not paraphrase the users share in second or third person. 
                Be specific and avoid generic statements.
                Aim for a crisp and concise but complete summary that captures all the main points.
                Do not add emotions, feelings, or interpretations that are not obvious from the original text.
                The summary should make the person feel heard, without any judgement or advice. 
                The rephrasing should be different than the original speech but maintain the same meaning and emotional tone.
                Paraphrase the text regardless of length, language or speaking/singing style.

Original: ${transcript}

Rephrased reflection:`
```
- **Max Tokens**: 300 (increased from 80)
- **Focus**: Better structure, clearer instructions
- **Issues**: Stopped enforcing first person consistently after switching to gemini-2.5-flash

#### v4.0 - Critical First Person Enforcement (September 29, 2025)
```javascript
const prompt = `CRITICAL: You must rephrase this personal reflection EXCLUSIVELY in first person using "I" statements. 

RULES:
- Start every sentence with "I" 
- NEVER use "you", "they", "he", "she", "it", or any second/third person pronouns
- NEVER say "what I'm hearing" or "I understand that you..."
- Write as if the person is speaking about their own experience
- Be specific and avoid generic statements
- Capture all main points in a crisp, concise summary
- Do not add emotions, feelings, or interpretations not in the original
- Make the person feel heard without judgement or advice
- Maintain the same meaning and emotional tone
- Paraphrase regardless of length, language or speaking or singing style

Original: ${transcript}

Rephrased reflection (FIRST PERSON ONLY):`
```
- **Max Tokens**: 300
- **Focus**: Strict first person enforcement
- **Status**: Superseded by v4.1

#### v4.1 - Refined First Person Rules (September 29, 2025)
```javascript
const prompt = `CRITICAL: You must rephrase this personal reflection EXCLUSIVELY in first person using "I" statements. 

RULES:
- Respond in first person perspective.
- NEVER use any second/third person pronouns unless I use them myself
- NEVER say "what I'm hearing" or "I understand that you..."
- Write as if you are the person is speaking about their own experience
- Be specific and avoid generic statements
- Capture all main points in a crisp, concise summary
- Do not add emotions, feelings, or interpretations not in the original
- Make the person feel heard without judgement or advice
- Maintain the same meaning and emotional tone
- Paraphrase regardless of length, language or speaking or singing style

Original: ${transcript}

Rephrased reflection (FIRST PERSON ONLY):`
```
- **Max Tokens**: 300
- **Focus**: Refined first person rules with more flexibility
- **Changes**: 
  - Changed "Start every sentence with 'I'" to "Respond in first person perspective"
  - Added "unless I use them myself" for pronoun flexibility
  - Fixed grammar: "Write as if you are the person is speaking"
- **Status**: Current version

### Model Evolution

#### Gemini Model Changes
1. **Initial**: `gemini-1.5-flash` (early 2025)
2. **September 26, 2025**: `gemini-1.5-flash-001` (attempted fix for API issues)
3. **September 28, 2025**: `gemini-2.5-flash` (attempted upgrade)
4. **September 28, 2025**: `models/gemini-2.5-flash` (attempted with full path)
5. **September 28, 2025**: `gemini-2.0-flash-001` (current stable version)

#### Model Selection Rationale
- **`gemini-2.0-flash-001`**: Chosen for stability and reliability
- **Alternative considered**: `gemini-2.5-flash` (newer, more capable but had API access issues)
- **Fallback models**: OpenAI GPT-4o-mini, Anthropic Claude-3-haiku-20240307

### Fallback Logic Evolution

#### Initial Fallback (July 2025)
```javascript
// Simple fallback: echo or basic paraphrase
summary = transcript
  ? `I heard: "${transcript}".`
  : "No meaningful content was provided to summarize.";
```

#### Current Fallback (September 29, 2025)
```javascript
// Fallback if LLM returns empty or generic response
if (
  !summary ||
  summary.toLowerCase().includes("please provide the personal share") ||
  summary.toLowerCase().includes("i need the text") ||
  summary.length < 3 // Too short to be meaningful
) {
  // Simple fallback: echo or basic paraphrase
  summary = transcript
    ? `I heard: "${transcript}".`
    : "No meaningful content was provided to summarize.";
}
```

### Key Issues Resolved

1. **Summary Truncation** (August 26, 2025)
   - **Problem**: Summaries cut off at 80 tokens
   - **Solution**: Increased to 300 tokens

2. **First Person Consistency** (September 29, 2025)
   - **Problem**: AI was using second/third person ("you're pleased", "what I'm hearing")
   - **Solution**: Explicit rules and "CRITICAL" instruction

3. **Model Stability** (September 28, 2025)
   - **Problem**: `gemini-2.5-flash` had API access issues
   - **Solution**: Switched to stable `gemini-2.0-flash-001`

### Performance Metrics

- **Token Limit**: 300 (allows ~200-250 words)
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Response Time**: ~2-3 seconds average
- **Success Rate**: ~95% (with fallback handling)

### Future Considerations

1. **Model Upgrades**: Consider `gemini-2.5-flash` when API access stabilizes
2. **Prompt Refinement**: Monitor first person compliance
3. **Token Optimization**: May adjust based on usage patterns
4. **Fallback Improvement**: Consider more sophisticated fallback strategies

---

*Last Updated: September 29, 2025*
*Current Model: gemini-2.0-flash-001*
*Current Prompt: v4.1 (Refined First Person Rules)*
