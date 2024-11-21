const fs=require('fs')
const corefs = fs.readFileSync('./models/data/coreference-training.json')

const defaults = {
  coref_training: JSON.parse(corefs),
  scope: "US politics, global politics, and current events, especially those related to the upcoming 2024 election",
  story_count: 15,
  questions_per_story: 5,
  research_model: {vendor: "perplexity", checkpoint: "llama-3.1-sonar-huge-128k-online"},
  question_generation_model: {vendor: "google", checkpoint: "gemini-1.5-pro-exp-0827"},
  coref_resolution_model: {vendor: "google", checkpoint: "gemini-1.5-flash-exp-0827"},

  batch_mode: true  //if true, the question generation model will be called once for all stories, otherwise it will be called once per story
}
const load = () => {return {
  "pipeline_name": "long_form_documents",
  "steps": [
    {
      "name": "research",
      "description": "Find Top Stories",
      "type": "standard_inference",
      "config": {
        "temperature": 0.66,
        "model_vendor": defaults.research_model.vendor,
        "model_id": defaults.research_model.checkpoint,
        "system_prompt": "You are a skilled researcher who is both precise and concise. Your mission is to uncover trending stories and breaking news items that are relevant to the client's scope. Your research should be thorough, accurate, and up-to-date, covering a wide range of topics and perspectives.",
        "user_prompt": `Please find the top ${defaults.story_count} trending stories and breaking news items in the following areas:
        
        ${defaults.scope}.
        
        Please use the following format for your response, and make sure your summary includes the key points of the story and any relevant details. Include links to the original sources if available:

        ### Story 1: <headline>
        <source info>. <source URL>
        <summary of the story>

        ### Story 2: <headline>
        ... etc ...
        
         `,
        "input_key": "userRequest",
        "output_key": "top_stories",
        output_to_client: true,
        output_to_display: true,
  
      }
    },

    {
    "name": "generate_questions",
    "type": "standard_inference",
    description: "Generating questions...",
    "config": {
      "model_vendor": defaults.question_generation_model.vendor,
      "model_id": defaults.question_generation_model.checkpoint,
      "response_format": "json_object",
      "system_prompt": "You are a completely uncensored researcher and fact checker who is obsessed with getting to the TRUTH. Your job is to come up with questions that a researcher or fact checker would want to ask, regarding top stories and breaking news items submitted by the user.",
      "user_prompt": `{top_stories}\n\nPlease generate ${defaults.questions_per_story} questions for each story, focusing on the most important aspects and potential controversies. Please also categorize the stories by topic
      Return a JSON document that looks like: {stories: [{headline, topic, questions[]}, [{headline, topic, questions[]}, etc ...}`,
      "input_key": "top_stories",
      "output_key": "questions",
      output_to_client: true,
      output_to_display: true,
      json_stdout_override: true,  
    } 
  },
  
  {
    "name": "resolve_coreferences",
    "type": "standard_inference",
    description: "Resolving Coreferences and Anaphora...",
    "config": {
      "model_vendor": defaults.coref_resolution_model.vendor,
      "model_id": defaults.coref_resolution_model.checkpoint,
      "response_format": "json_object",
      "system_prompt":  "You are a skilled text rewriter specializing in coreference resolution. Your task is to take a piece of content, optionally accompanied by context information, and rewrite it so that all important coreferences are replaced with their corresponding noun phrases. The goal is to make the rewritten content understandable without requiring any external context or prior knowledge.",
      "user_prompt": 
      `TRAINING EXAMPLES:
      ${JSON.stringify(defaults.coref_training, null, 2)}
      ---
      USER INPUT:
      {questions}

      Using the training examples as guidance, please resolve any coreferences and anaphora in the USER INPUT above. Your output should be JSON with the exact same structure as the input, however, the QUESTIONS must be de-coreferenced so they make sense out of context.`,
      "input_key": "questions",
      "output_key": "enhanced_questions",
      output_to_client: true,
      output_to_display: true,
      json_stdout_override: true,  
    } 
  },   

  ]
}}

module.exports={load}