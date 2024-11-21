const transforms = {
    //enables no code random sampling in mappers
    "groupItemsBySection" : (items) => {
    const groupedItems= [];
  
    items.forEach((item) => {
      const sectionMatch = item.task.match(/^\[(.*?)\]/); // Extract section name
      const sectionName = sectionMatch ? sectionMatch[1] : 'Unknown'; // Default to 'Unknown' if no section
  
      const existingSection = groupedItems.find(
        (group) => group.section === sectionName
      );
  
      if (existingSection) {
        existingSection.items.push(item);
      } else {
        groupedItems.push({ section: sectionName, items: [item] });
      }
    });
  
    return {grouped_items: groupedItems};
  }
}
const {CohereClient} = require("cohere-ai")


const downsampleArray= (array, downsample_to) => {
    const result = [];
    const indices = new Set();
  
    while (result.length < downsample_to) {
      const randomIndex = Math.floor(Math.random() * array.length);
      if (!indices.has(randomIndex)) {
        indices.add(randomIndex);
        result.push(array[randomIndex]);
      }
    }
  
    return result;
  }


//a generic content loader
const multiTool = async (input, step, c) => {
  const fs = require('fs');
 
  let ctx = input.trim();
 
  // Use a regular expression to split by whitespace or newline
  const tokens = ctx.match(/\S+/g) || []; // This will handle spaces, tabs, and newlines
 
  //scrape and attach any remote resources included by user
  const urls = tokens.filter(x => x.startsWith("@http://") || x.startsWith("@https://")).map(ref => ref.replace('@', ''));
 
  for (let url of urls) {
    try {
      let response = await fetch(step.config?.tool_options?.no_jina ? url : `https://r.jina.ai/${url}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.text();
      ctx = `\n\n[${url}]\n\n${data}\n\n---\n\n${ctx}`;
    } catch (error) {
      console.error(`Error fetching URL ${url}:`, error);
      ctx = `\n\n[${url}]\n\nUnable to retrieve\n\n---\n\n${ctx}`;
    }
  }
 
  //attach a file on disk (i.e. something user uploaded via the webapp)
  const files = tokens.filter(x => x.startsWith("@file://")).map(ref => ref.split("://")[1]);
  files.forEach(ref => {
    try {
      const content = fs.readFileSync(ref);
      ctx = `\n\n[${ref}]\n\n${content}\n\n---\n\n${ctx}`;
    } catch (error) {
      console.error(`Error reading file ${ref}:`, error);
      ctx = `\n\n[${ref}]\n\nUnable to retrieve\n\n---\n\n${ctx}`;
    }
  });
  return ctx; 
  //Note: this loader is not multimodal... a good project to work on hint hint
 };
 const fixJson = (rawText) => {
    if (typeof rawText === "string") {
        //console.log("String output detected, attempting JSON conversion")
        const trimmed = rawText.trim()
        if (trimmed.startsWith("{") || trimmed.startsWith("["))
            return JSON.parse(trimmed)
        else if (trimmed.indexOf("```json")> - 1) {
            const payload = trimmed.split("```json")[1].split("```")[0]
            return JSON.parse(payload)
        } else
        {
            console.error("Text is not valid JSON... will return generic")
            return {text: trimmed}
        }
    } else {
        return rawText //its already json, nothing to do
    }
}

const ttsTool = async(input, step, ctx) => 
{
    const {ElevenLabsClient, play} = require('elevenlabs')
    const elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY // Defaults to process.env.ELEVENLABS_API_KEY
    })
    
     const payload= {text: input, ...step.config["tool_options"]}
     if (!payload.voice_id) {
      if (!step.config.voice_key)  {
        payload.voice_id="tnSpp4vdxKPjI9w0GnoV"
        payload.voice="Hope"
        //console.log("[debug] no voice preferences found, defaulting to hope@elevenlabs")
      } else if (step.config.voice_key && typeof ctx[step.config.voice_key] == "object") {
        payload.voice_id = ctx[step.config.voice_key].best_voices[0].voice_id
        payload.voice = ctx[step.config.voice_key].best_voices[0].name
        //console.log("[debug] Using LLM-contextually-chosen-voice "+ ctx[step.config.voice_key].best_voices[0].name)
      } else {
        payload.voice_id="tnSpp4vdxKPjI9w0GnoV"
        payload.voice="Hope"
        //console.log("[debug] unable to load voices file, using default")
      }
     }

     const audio = await elevenlabs.generate(payload);
    const fileName =  `./temp/${step.config["output_key"] || "output"}.mp3`
    const fs = require('fs')
    const fileStream = fs.createWriteStream(fileName);

    audio.pipe(fileStream);
    //fileStream.on("finish", () => //console.log("audio ready")); // Resolve with the fileName

    return fileName

}
const voiceChooser = async(input, step, ctx) => {
  const fs = require('fs')
  const useCase = step.config["tool_options"]["use_case"] || ctx["userRequest"]
  const voices = require('./models/data/voices.json')

  const prompt = `Available Voices:
  {voices}
  
  Use Case:
  {userRequest}
  
  ---
  
  Based on the context, please return the top 3 voices best suited to handling the user's request. 
  Return ONLY JSON {voices:[{voice_id, name, gender, why_you_chose_this_voice}]}`

}


const getSearchQueriesForPrompt = async(input, step, ctx) => {
  const client = new CohereClient({ token: process.env.COHERE_API_KEY});        
  const results = await client.chat(
    {
      message: input,
      model: "command-r-plus-08-2024",
      preamble: "You are an assistant to a fact checker. Given a document, question, or statement, identify any claim(s) made which need to be fact checked, or assertions that require further research",
      searchQueriesOnly: true
    }
  )
  return (results.isSearchRequired ? results.searchQueries.map(x => x.text) : [])
}

const extractClaimsToFactCheck = async(input) => {

  const client = new CohereClient({ token: process.env.COHERE_API_KEY});        
  const response = await client.chat(
    {
      message: input,
      model: "command-r-plus-08-2024",
      responseFormat: {type: "json_object", schema: {"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"factcheck_required":{"type":"boolean","description":"Indicates whether there are claims that require fact-checking"},"claims_to_factcheck":{"type":"array","description":"An array of claim objects to be fact-checked","items":{"type":"object","properties":{"claim":{"type":"string","description":"The text of the claim to be fact-checked"},"priority":{"type":"string","enum":["high","medium","low"],"description":"The priority level for fact-checking this claim"}},"required":["claim","priority"]}}},"required":["factcheck_required","claims_to_factcheck"]}},
      preamble:`You are an assistant to a reporter and fact checker. Given a document, question, or statement made by the user, 
      figure out the core message(s) of what they're asking your team to research. Return items in descending order of priority. Return JSON`
    }
  )

  //process.stdout.write(JSON.stringify(response, null, 2))
  return JSON.parse(response.text)
}
const getPrimaryClaim =  async(input) => {
  const results = await extractClaimsToFactCheck(input)
  if (results.factcheck_required && results.claims_to_factcheck.length > 0) 
    return results.claims_to_factcheck[0].claim 
  else
    return "Error: Unable To Parse"
}


module.exports = {fixJson, transforms, downsampleArray, multiTool, ttsTool, getPrimaryClaim, extractClaimsToFactCheck, getSearchQueriesForPrompt}