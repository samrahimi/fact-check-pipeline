const keys = require('@samrahimi/key-mixer')
const AGENT_SESSIONS={}

// // Google AI client
// const googleAI = new GoogleGenerativeAI(keys.getKey("GOOGLE_AI_API_KEY"));
function generateMarkdownCitations(data) {
  let markdown = '\n\n';
  for (let i = 0; i < data.documents.length; i++) {
    const doc = data.documents[i];
    markdown += `- **${doc.title}.** ${doc.url}\n`;
    //markdown += `${doc.snippet.substring(0, 200)}...\n\n`;
  }
  return markdown+"\n\n";
 }
 
async function init() {
  try {
    const OpenAI = (await import('openai')).default;
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');
    
    // Cohere native client, use this NOT openrouter if using cohere
    const { CohereClient, Cohere } = require('cohere-ai');
    const cohere = new CohereClient({
      token: keys.getKey("COHERE_API_KEY"),
    });

    // OpenAI client for calling official OpenAI models
    const openai = new OpenAI({
      apiKey: keys.getKey("OPENAI_API_KEY"),
    })

    // Perplexity API is openai compatible
    const perplexity = new OpenAI({
      apiKey: keys.getKey("PERPLEXITY_API_KEY"), 
      baseURL: "https://api.perplexity.ai"
    })

    const mistral_openai = new OpenAI({
      apiKey: keys.getKey("MISTRAL_API_KEY"),
      baseURL: 'https://api.mistral.openai.com',
    })

    
    // OpenRouter API is openai compatible
    // For inference, set the model to {vendor}/{model_id} (anthropic/claude-3.5, etc.)
    const openrouter = new OpenAI({
      apiKey: keys.getKey("OPENROUTER_API_KEY"),
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // Google AI client
    const googleAI = new GoogleGenerativeAI(keys.getKey("GOOGLE_AI_API_KEY"));

    return {  openai, openrouter, perplexity, googleAI, mistral_openai, cohere, Cohere, HarmBlockThreshold, HarmCategory };
  } catch (error) {
    console.error('Error initializing AI clients:', error);
    throw error;
  }
}



class Agent {
  constructor(config) {
    this.config = config;
    this.messages = [{ role: 'system', content: this.config.system_prompt }];
    const { v4: uuidv4 } = require('uuid');
    this.agent_id = this.config.agent_id || uuidv4();
    AGENT_SESSIONS[this.agent_id] = this;
  }
  static loadSession(agent_id) {
    //todo retrieve a live instance of an Agent from a database or cache
    const agent = AGENT_SESSIONS[agent_id];
    if (agent) {
      return agent;
    } else {
      // TODO: Retrieve the agent from the database or cache based on the given id
      // and return the live instance of the Agent
      console.log(`[loadSession] Could not find agent with id ${agent_id}`);
      return null;

    }
  }
  rejiggerConfig(newConfig) {
    this.config = newConfig;
    this.messages.find(x =>x.role == "system").content = this.config.system_prompt //[{ role: 'system', content: this.config.system_prompt }];
  }
  setSystemPrompt(newPrompt) {
    this.messages[0].content = newPrompt;
  }
  //the RAGContext is a dictionary of key-value pairs that can be shared between different steps in the pipeline
  //right now only our Cohere code uses it, but it could be useful for other things in the future
  async performInference(userMessage, RAGContext) {
    
    //the following lookup table is utterly asinine but i can't think of a better way, can you?
    //the idea is that we want to represent agent state in a vendor-agnostic way
    //like [{role: 'system', content: 'hey'}, {role: 'user', content: 'hello'}, {role: 'assistant', content: 'hi'}]
    const role2role = {
      google: {
        "user": "user",
        "assistant": "model",
        "system": "user",
        "function": "function"
      },
      //CHATBOT, SYSTEM, or USER
      cohere: { 
        "user": "USER",
        "assistant": "CHATBOT",
        "system": "SYSTEM",
        "function": "CHATBOT"
      }
    }

    const { mistral, openai, openrouter, anthropic, perplexity, googleAI, mistral_openai, cohere, Cohere, HarmBlockThreshold, HarmCategory } = await init()
    this.messages.push({ role: 'user', content: userMessage });

    //DEBUG
    if (this.config.DEBUG) {
      process.stdout.write(JSON.stringify(this.messages, null, 2))
    }

    let response;
    let stream;
    let fullResponse = '';

    if (this.config.model_vendor === 'openai') {
      stream = await openai.chat.completions.create({
        model: this.config.model_id,
        messages: this.messages,
        response_format: { type: this.config.response_format || 'text' },
        max_tokens: this.config.max_tokens || 4096,
        stream: true,
        temperature: this.config.temperature || 0.7
      });
    }
    // [UNSTABLE - use mistral_openai instead. The Mistral API is not yet stable]
    else if  (this.config.model_vendor === 'mistral') {
      stream = mistral.chatStream({
        model: this.config.model_id,
        messages: this.messages,
        response_format: { type: this.config.response_format || 'text' },
        max_tokens: this.config.max_tokens || 4096,
        stream: true,
        temperature: this.config.temperature || 0.7
      });
    }
    else if  (this.config.model_vendor === 'perplexity') {
      stream = await perplexity.chat.completions.create({
        model: this.config.model_id,
        messages: this.messages,
        response_format: { type: this.config.response_format || 'text' },
        max_tokens: this.config.max_tokens || 4096,
        stream: true,
        temperature: this.config.temperature || 0.7
      });
    }
    else if  (this.config.model_vendor === 'mistral_openai') {
      stream = await mistral_openai.chat.completions.create({
        model: this.config.model_id,
        messages: this.messages,
        response_format: { type: this.config.response_format || 'text' },
        max_tokens: this.config.max_tokens || 4096,
        stream: true,
        temperature: this.config.temperature || 0.7
      });
    }
    else if (this.config.model_vendor === "cohere") {
      const payload = {
        model:  this.config.model_id,
        preamble: this.config.system_prompt,
        message: userMessage,
        chatHistory: process.env.ENABLE_COHERE_CHAT_HISTORY ?
          this.messages.slice(1, this.messages.length-1): [],
        temperature: this.config.temperature || 0.8,
        max_tokens: this.config.max_tokens,

        connectors: this.config.tool_options?.web ? [
          {
            id: "web-search",
            continueOnFailure: false,
            options: this.config.tool_options?.search_domain ? {
              "site":this.config.tool_options?.search_domain
            } : {}
          }
        ] : [],
        citationQuality: this.config.tool_options?.citationQuality ? this.config.tool_options?.citationQuality : "fast"
    
        // Other parameters from the Chat API reference can be added here
      }

      if (RAGContext && this.config.tool_options?.use_cached_documents)
        payload.documents = RAGContext['__documents__']
      //process.stdout.write(JSON.stringify(payload, null, 2))
      stream = await cohere.chatStream(payload)   
      
    }

    else if (this.config.model_vendor == "anthropic") {
      stream = await anthropic.messages.stream({
        model: this.config.model_id,
        messages: this.messages,
        max_tokens: this.config.max_tokens || 4096,
        temperature: this.config.temperature || 0.7
      });

    }

    //Ah, Gemini... 
    else if (this.config.model_vendor == "google") {
      var safetySettings =  [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE
        }
      ]

      /* Disabled by default according to google
      if (this.config.model_id.includes("0827")) {
        safetySettings = [...safetySettings, 
          {category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, 
            threshold: HarmBlockThreshold.BLOCK_NONE}
          ]
      } */


      const model = googleAI.getGenerativeModel({ 
        model: this.config.model_id,
        systemInstruction: this.messages[0].content,
        safetySettings
      });
      const chat = model.startChat({
        history: this.messages.filter(x => x.role != "system").map(msg => ({ role: role2role.google[msg.role], parts: [{ text: msg.content }] })),
        generationConfig: {
          temperature: this.config.temperature || 0.7,
          maxOutputTokens: this.config.max_tokens || 4096,
          responseMimeType: this.config.response_format && this.config.response_format == "json_object" ? 
            "application/json" 
            : 
            "text/plain"
        }
      });
      const result = await chat.sendMessageStream(userMessage);
      stream = result.stream;
    }
    else if (this.config.model_vendor === 'openrouter') {
      stream = await openrouter.chat.completions.create({
        model: this.config.model_id,
        messages: this.messages,
        max_tokens: this.config.max_tokens || 4096,
        stream: true,
        temperature: this.config.temperature || 0.7,
        response_format: { type: this.config.response_format || 'text' }
      });
    } else {
      //Openrouter is a fallback. Always use native clients when possible
      let openrouter_model = `${this.config.model_vendor}/${this.config.model_id}`;

      //console.log(`[inference] Inference not yet implemented for model vendor ${this.config.model_vendor}`);
      //console.log(`[inference] Loading ${openrouter_model} via OpenRouter gateway, un momento...`);

      stream = await openrouter.chat.completions.create({
        model: openrouter_model,
        messages: this.messages,
        max_tokens: this.config.max_tokens || 4096,
        stream: true,
        temperature: this.config.temperature || 0.7
      });
    }

    //process.stdout.write("\n\n ["+this.config.model_id+"]\n\n ")

    //if (this.config?.response_format == "json_object")
    //  process.stdout.write(" \n\n```text\n\n ") 
    
    //so that we only show the placeholder or delimiter message once, when citations start generating
    let citationsNoticeAlreadyDisplayed = false
    for await (const chunk of stream) {
      let content=""; //use this to specify what to show next in the output
      let writeNextChunkToOutputStream = true //if false, the contents of "content" will be appended to the value that gets returned after generation is done... however it will not be displayed in realtime as part of a stream

      if (this.config.model_vendor === "cohere") {
        if (!citationsNoticeAlreadyDisplayed && chunk.eventType == "citation-generation" && this.config.tool_options.citationsPlaceholderText) {
          content=this.config.tool_options.citationsHeaderText
          citationsNoticeAlreadyDisplayed = true
        }
        if (chunk.eventType == "stream-end") {
          try
          {
            content = generateMarkdownCitations(chunk.response)
            
            if (this.config.tool_options?.cache_documents && RAGContext) 
              RAGContext["__documents__"] = chunk.response.documents || null

            if (!this.config.tool_options?.appendCitationsToMarkdownStream)
              writeNextChunkToOutputStream=false
          }
          catch (ex)
          {}
        } else if (chunk.eventType === "text-generation") {
          content = chunk?.text || '';
        } else {
          //process.stdout.write(strea)
        }
      }
       else if (this.config.model_vendor === 'anthropic') {
        content = chunk.delta?.text || '';
      } else if (this.config.model_vendor === 'google') {
        content = chunk.text() || '';
      } else if (this.config.model_vendor === "mistral") {
        content = chunk.data.choices[0]?.delta?.content || ''
      } else {
        content = chunk.choices[0]?.delta?.content || '';
      }

      //streaming display is conditional, but all content is always added to the full response either way
      if (writeNextChunkToOutputStream && 
        this.config.output_to_display &&
        (this.config.json_stdout_override || this.config?.response_format != "json_object"))
        process.stdout.write(content); // Log the stream to the console
      fullResponse += content; // Collect the full response
    }

    //json stdout override is used for things like images, where we don't want to show the delimiter
    if (!this.config.json_stdout_override)
      process.stdout.write(process.env.MESSAGE_DELIMITER || "\n\n")

    // if (this.config?.response_format == "json_object")
    //   process.stdout.write(" \n\n``` \n\n ")
    // else
    //   process.stdout.write("\n\n   \n\n   \n\n")
    this.messages.push({ role: 'assistant', content: fullResponse });
    return fullResponse;
  }
}

// Old school, I know... but I like the factory pattern
module.exports = { 
  createFromSettings: (agentSettings, forceOverwrite) =>{
    if (agentSettings.agent_id && !forceOverwrite) {
      const existingAgent = Agent.loadSession(agentSettings.agent_id)
      if (existingAgent) {
        existingAgent.rejiggerConfig(agentSettings)
        return existingAgent
      }
    }
    return new Agent(agentSettings) 
  },
  loadSession: Agent.loadSession
};
