import dotenv from "dotenv";
dotenv.config();
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

import { normalizeSpeakers } from "./normalize-speakers.js";
import { generateSingleSpeakerFiles } from "./getRep.js";
import axios from "axios";
import path from "path";
import fs from "fs";

export async function generateSalesVAD(sourceFolder, fileNameWithExtension) {
	try {
		// Set file path
		console.log("\nsetting file path");
		const filePath = path.join(sourceFolder, fileNameWithExtension);
		console.log("file path set", filePath);

		// Set API endpoint and options
		const url =
			"https://api.deepgram.com/v1/listen?utterances=true&model=phonecall&tier=nova&diarize=true&punctuate=true";
		const options = {
			method: "post",
			url: url,
			headers: {
				Authorization: `Token ${deepgramApiKey}`,
				"Content-Type": determineMimetype(fileNameWithExtension),
			},
			data: fs.createReadStream(filePath),
		};

		// get API response
		const response = await axios(options);
		const json = response.data; // Deepgram Response

		// Get utterances
		const uterrances = getUtterancesArry(json);

		// Normalize the utterances so there are only 2 speakers
		const normalized = await normalizeSpeakers(
			uterrances,
			fileNameWithExtension
		);

		// Determines the speakers
		// remove the unwanted speaker(s) & only keep 1 speaker
		const oneSpeakerJson = await generateSingleSpeakerFiles(
			JSON.stringify(normalized),
			removeSpeakerTemplate,
			"Rep"
		);

		// Return the transcript
		return oneSpeakerJson;
	} catch (err) {
		console.log(`Error with transcribeDiarizedAudio(): ${err}}`);
	}
}

function determineMimetype(file) {
	const extension = path.extname(file);
	switch (extension) {
		case ".wav":
			return "audio/wav";
		case ".mp3":
			return "audio/mpeg";
		case ".m4a":
			return "audio/mp4";
		// Add more cases as needed for different file types
		default:
			return "application/octet-stream"; // default to binary if unknown
	}
}

function getUtterancesArry(data) {
	console.log("Getting Utterances");
	// Create empty array
	let arr = [];

	// Extract the utterances array
	const utterances = data.results.utterances;
	// console.log(utterances);

	// Iterate over each utterance using forEach
	utterances.forEach((utterance) => {
		let { speaker, start, end, transcript } = utterance;

		// Use array destructuring to assign start and end times to arrays
		arr.push({ speaker, start, end, transcript });
	});

	return arr;
}

const removeSpeakerTemplate = `There are two primary speakers in the array below: Speaker 0 and Speaker 1 (or Speaker 1 and Speaker 2)

One of these Speakers is a sales rep and the other is a prospect. The sales rep is the one who introduces themselves as someone from Air Ai and/or states that the call is being recorded for quality assurance and/or talks about clients they've helped or businesses they've scaled and/or offers a consulting call and offers time to book a call.

Analyze the transcript and determine which speaker is the sales rep. Once you have the answer, just state "0" or "1" or "2" or "3" with no quotation marks:

{transcript}`;
