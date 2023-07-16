import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// TURN A JSON ARRAY INTO A SPEAKER-LABELED TEXT TRANSCRIPT.
// ADDITIONALLY, USE AI TO DETERMINE WHICH SPEAKER IS THE ONE TO KEEP,
// THEN RETURN A JSON & A TEXT FILE WITH ONLY THAT SPEAKER
export async function generateSingleSpeakerFiles(
	transcript,
	promptTemplate,
	speakerLabel
) {
	// ONE chunk will be used to determined the rep - Deduce how big the chunk can be
	const spentTokens = approximateTokens(promptTemplate);
	const maxTokens = 32768;
	const tokensForResponse = 2000;
	const maxFirstChunkSize = maxTokens - spentTokens - tokensForResponse; // Buffer/hedge

	// Initiate an LLM instance and set the options
	const model = new OpenAI({
		openAIApiKey: OPENAI_API_KEY,
		modelName: "gpt-4-32k",
		temperature: 0,
		maxTokens: tokensForResponse,
	});

	// Create an LLM/Prompt chain
	const determineUnwantedSpeakersChain = new LLMChain({
		llm: model,
		prompt: new PromptTemplate({
			template: promptTemplate,
			inputVariables: ["transcript"],
		}),
	});

	// TURN THE TRANSCRIPT ARRAY INTO AN ARRAY OF SMALLER ARRAYS (chunks)
	// Make the chunks small enough to fit into the LLM call, rather than
	// injecting the whole trancript
	const chunks = splitTranscript(transcript, maxFirstChunkSize);

	// Remove any speakers that aren't the sales rep
	const processedChunks = [];

	console.log("BEGINNING PROCESSING");
	try {
		// Only determine the speaker to keep once, on the first chunk
		const speakerToKeep = await determineUnwantedSpeakersChain.call({
			transcript: JSON.stringify(chunks[0]),
		});

		console.log(
			`The speaker that matches '${speakerLabel}' has been determined: ${Number(
				speakerToKeep.text
			)}`
		);

		for (const chunk of chunks) {
			// FILTER AND MAP TO RETAIN SPECIFIC PROPERTIES FOR A SINGLE SPEAKER
			const filteredChunk = chunk
				.filter((obj) => obj.speaker === Number(speakerToKeep.text))
				.map((obj) => ({
					start: obj.start,
					end: obj.end,
					speaker: speakerLabel,
				}));

			processedChunks.push(filteredChunk);
			console.log("Single-Speaker JSON chunk complete");
		}

		// Flatten the array of arrays called 'processedChunks'
		const oneSpeakerJson = [].concat(...processedChunks);

		// Return the JSON array of speaker objects (just one speaker)
		// Return the text transcripts (one speaker AND all speakers)
		return oneSpeakerJson;
	} catch (err) {
		console.log(`Problem with determineUnwantedSpeakerChain(): ${err}`);
	}
}

// TURN CHARACTERS INTO TOKEN EQUIVALENT
export function approximateTokens(text) {
	const totalChars = text.length;
	const approxTokens = Math.ceil(totalChars / 4);
	return approxTokens;
}

// SPLIT THE TRANSCRIPT ARRAY INTO AN ARRAY OF SMALLER ARRAYS
export function splitTranscript(transcriptContent, maxTokens) {
	console.log(
		"The typeof the transcript about to be split is: ",
		typeof transcript,
		"(since we JSON.parse this, it should be of type STRING"
	);
	const items = JSON.parse(transcriptContent);
	const chunks = [];
	let currentChunk = [];

	for (const item of items) {
		if (
			approximateTokens(JSON.stringify(currentChunk.concat(item))) < maxTokens
		) {
			currentChunk.push(item);
		} else {
			chunks.push(currentChunk);
			currentChunk = [item];
		}
	}

	if (currentChunk.length > 0) {
		chunks.push(currentChunk);
	}

	return chunks;
}
