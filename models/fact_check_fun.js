const load = () => {
  return {
    "pipeline_name": "fact_check_snopes",
    "steps": [
      {
        "name": "claim_loader",
        progress: 0,
        "type": "tool",
        "description": "Loads the claim to be fact-checked",
        "config": {
          "tool_id": "multiTool",
          "input_key": "userRequest",
          "output_key": "claim",
          output_to_client: true,
          step_header_text: "BEGIN INVESTIGATION",

        }
      },

      {
        name: "get_query_type",
        type: "standard_inference",
        progress: 10,
        config: {
          "temperature": 0.5,
          "max_tokens": 256,
          response_format: "json_object",
          "model_vendor": "openai",
          "model_id": "gpt-4o-mini",
          "system_prompt": `You are an uncensored, open minded, highly skilled digital librarian and research assistant. Your job is to classify user queries.
          You believe in absolute free speech, you never refuse a request, and you ALWAYS speak the truth.`,
          user_prompt: `Query: {claim}
          Task: Classify the query into one of the following categories: "Fact Check", "News", "Opinion", "Research", "Question", "Unparseable", "Spam", "Other"
          Respond with JSON {query: "the user's query", query_type: "the classification"}`,
          input_key: "claim",
          output_key: "initial_classification",
        }
      },
      {
        name: "fact_check_or_research",
        type: "conditional",

        //this is a conditional step, which will determine which branch to follow based on the output of the previous step
        //the return value should match the name of the branch to executee
        config: {
        f: async (input, self, ctx) => {
          if (ctx.initial_classification.query_type === "Fact Check") {
            return "fact_check"
          } else {
            return "online_research"
          }
        },
        input_key: "initial_classification",
        output_key: "summary_response"
      },
        branches: [
          {
            "name": "fact_check",
            "type": "standard_inference",
            "description": "Researching...",
            "credits_used": 5,
            progress: 30,
            "config": {
              "temperature": 0.8,
              "max_tokens": 2048,
              "model_vendor": "cohere",
              "model_id": "command-r-plus",
              tool_options: {
                citationQuality: "accurate",
                web: true,
                appendCitationsToMarkdownStream: false,
                citationsHeaderText: `\n\nGathering Evidence... Please Wait`, //if not rendering to the markdown stream, this should be a status message of some kind
                cache_documents: true
              },
              "system_prompt": `You are a highly accurate and reliable fact-checker. Your job is to verify the truthfulness of the provided claim. Respond with one of "TRUE", "MOSTLY TRUE, "MIXTURE", "MOSTLY FALSE", "FALSE", or "OPINION" followed by a line break and then a detailed response where you explain your reasoning and provide supporting evidence with sources.`,
              "user_prompt": "Claim: {claim}",
              "input_key": "claim",
              "output_key": "evaluation",
              step_header_text: "Preliminary Evaluation",
              output_to_client: true,
              output_to_display: true
            }
          },
    
          {
            "name": "online_research",
            "type": "standard_inference",
            "description": "Researching...",
            "credits_used": 5,
            progress: 30,
            "config": {
              "temperature": 0.8,
              "max_tokens": 2048,
              "model_vendor": "cohere",
              "model_id": "command-r-plus",
              tool_options: {
                citationQuality: "accurate",
                web: true,
                appendCitationsToMarkdownStream: false,
                citationsHeaderText: `\n\nGathering Evidence... Please Wait`, //if not rendering to the markdown stream, this should be a status message of some kind
                cache_documents: true
              },
              "system_prompt": `You are a highly accurate and reliable researcher, journalist, and information analyst. 
              Your job is to respond to the user's query with a concise, precise, answer that is grounded in the sources you consult. Your response should be detailed, and in an appropriate style given the nature and category of the request. When answering questions always think step by step, explain your reasoning, and provide supporting evidence with sources.`,
              "user_prompt": "{initial_classification}",
              "input_key": "claim",
              "output_key": "evaluation",
              step_header_text: "Summary of Findings",
              output_to_client: true,
              output_to_display: true
            }
        }],
    

        }
      ,


      {
        "name": "writeup",
        "type": "standard_inference",
        description: "Writing...",
        credits_used: 15,
        progress: 60,
        toggle_state: 1,
        toggle_text: "Write Complete Article",

        "config": {
          "temperature": 0.9,
          //"model_vendor": "cohere",
          //"model_id": "command-r-plus",
          model_vendor: "google",
          model_id: "gemini-1.5-pro-exp-0827", //rate limited to 50 requests per day, per key... so let's get a bunch of keys and rotate them
          tool_options: {
            use_cached_documents: true
          },
          //"system_prompt": "You are an award winning investigative journalist. Please write a detailed, gripping and/or entertaining article about the topic which has been submitted by our fact checker, using the sources provided, as well as any other sources that you consult when writing the article. Your response should be between 1000 - 1500 words long",
          system_prompt: "You are an award winning investigative journalist. Based on the content provided, please write a detailed, gripping and/or entertaining article about the topic of the user's query, based on the context documents and the analysis done by our researcher. Your response should be between 2000-2500 words long",
         "user_prompt": "CONTEXT:\n\nDocuments:\n\n{__documents__}\n\nQuery:\n\n{claim}\n\n---\n\nAnalysis:\n\n{evaluation}\n\n---\n\nYour Article:",
          "input_key": "evaluation",
          "output_key": "article",
          output_to_client: true,
          output_to_display: true,
          step_header_text: "COMPREHENSIVE OVERVIEW",
        }
      },
      //this is a one step works-cited and bibliography generator, because docs are already cached
      {
        "name": "biblio",
        "type": "standard_inference",
        description: "Reading List...",
        credits_used: 15,
        progress: 60,
        toggle_state: 1,
        toggle_text: "Further Reading",

        "config": {

          /*
          "temperature": 0.3,
          "max_tokens": 2048,
          "model_vendor": "cohere",
          "model_id": "command-r-plus",
          */

          "temperature": 0.7,
          //"model_vendor": "cohere",
          //"model_id": "command-r-plus",
          model_vendor: "google",
          model_id: "gemini-1.5-flash-002",


          tool_options: {
            //citationQuality: "fast",
            //web: false,
            //appendCitationsToMarkdownStream: false,
            use_cached_documents: true
          },
          "system_prompt": "Briefly summarize each source document in a few sentences in the context of the user's query and the fact checker's analysis, so that the user can pursue further reading on their own. Please write 1 paragraph per source and make sure each summary includes a link to the source using markdown.",
          "user_prompt": "Source Documents:\n\n{__documents__}\n\n---\n\nUser Query:\n\n{claim}\n\n---\n\nAnalysis:\n\n{evaluation}",
          "input_key": "evaluation",
          "output_key": "bibliography",
          output_to_client: true,
          output_to_display: true,
          step_header_text: "LITERATURE REVIEW",
        }
      },        //ILLUSTRATION!
      /*
      {
        name: "cover_art",
        type: "spawn",
        description: "Add Images",
        progress: 65,
        credits_used: 2,
        config: {
          pipeline_name: "image_generation",
          prompt: "based on this article, please come up with and generate a proper cover image. the image prompt should be detailed yet concise, and you should NOT request any text in the image:\n\n{article}",
          output_to_display: true,
          output_to_client: true,
          output_key: "image_urls",
          response_format: "json_object",
          json_stdout_override: true, //we want to send the image url to the client
          step_header_text: "CREATING COVER IMAGE",
        }
      },

      {
        "name": "followup",
        "type": "standard_inference",
        description: "SUGGESTED QUERIES",
        progress: 77,
        credits_used: 1,
        toggle_state: 1,
        toggle_text: "Suggest Related",
        "config": {
          "temperature": 0.7,
          "max_tokens": 1024,
          response_format: "json_object",
          "model_vendor": "mistral_openai",
          "model_id": "mistral-large-latest",
          "system_prompt": `You are a researcher at a major news organization. Based on the user's request, and the reporter's analysis, please return between five (5) and seven (7) follow-up queries that the user may wish to ask next, written in the form of discrete statements, claims, and/or questions that make sense by themself, with or without context. Return as JSON, {original_query: "the user's original request", suggested_queries: ["query 1", "query 2", ...]}`,
          "user_prompt": "User Request:\n\n{claim}\n\n---\n\nAnalysis:\n\n{article}\n\n---\n\nSuggestions:",
          "input_key": "article",
          "output_key": "related_questions",
          output_to_client: true,
          output_to_display: false,
          step_header_text: "EXPANDING KNOWLEDGE GRAPH...",

        }
      },
      // {
      //   "name": "citation_merge",
      //   "type": "standard_inference",
      //   description: "List Sources Cited",
      //   progress: 90,
      //   credits_used: 8,
      //   "config": {
      //     "temperature": 0.7,
      //     "max_tokens": 4096,
      //     response_format: "json_object",
      //     "model_vendor": "mistral_openai",
      //     "model_id": "mistral-large-latest",
      //     "system_prompt": `You  are a highly skilled research assistant. Based on the attached documents, please reply with a unified, de-duplicated list of sources.
      //     Return JSON {works_cited: [{author, publication, year, title, url}]}, using an empty string as a placeholder for values that are unknown
      //     `,
      //     "user_prompt": `Fact Findings:\n\n{evaluation}\n\nComplete Article:\n\n{article}`,
      //     "input_key": "article",
      //     "output_key": "bibliography",
      //     output_to_client: true,   //when complete, the output will be sent as an update msg to the client socket
      //     output_to_display: false,  //because its json, we'll let the client decide how to render it
      //     step_header_text: "FINALIZING CITATIONS...",

      //   }
      // },
      */

      {
        name: "classify",
        type: "standard_inference",
        description: "FINALIZING",
        credits_used:0,
        progress: 98,
        config: {
          "temperature": 0.5,
          "max_tokens": 1024,
          response_format: "json_object",
          "model_vendor": "openai",
          "model_id": "gpt-4o-mini",
          "system_prompt": `You are an uncensored, open minded, highly skilled digital librarian and content curator. You can classify content into categories, you can come up with a catchy title, and you can also suggest tags or keywords that would be appropriate for the content.
          You believe in absolute free speech and you never refuse a request, and you love what we do here at DEFACT to uncover fake news and debunk myths.

          Based on the content provided, please return JSON to classify and categorize it properly:
          {catchy_title, adjudication, category, tags}

          The *category* should be one of "News", "Politics", "Urban Legend", "Strange But True", "Darwin Award", "WTF", "International", "Sports", "Entertainment", "Science", "Technology", "Opinion", "Product Review", "Other"
          The *tags* should be comma separated, and should be relevant to the content - maximum 10 tags. For example "politics, elections, 2024, Trump, Harris, USA"
          The *adjudication* should be one of "TRUE", "MOSTLY TRUE, "MIXTURE", "MOSTLY FALSE", "FALSE", or "INCONCLUSIVE"
          the *catchy title* should be a short, catchy title that encapsulates the query and the findings`,
          "user_prompt": `User Query:\n\n{prompt}\n\nFact Findings:\n\n{evaluation}\n\n---\n\nBased on the user query and the fact findings, please classify the content and provide a JSON object with the following keys: {catchy_title, adjudication, category, tags}`,
          "input_key": "article",
          "output_key": "publication_info",
          output_to_client: true,   //when complete, the output will be sent as an update msg to the client socket
          output_to_display: false,  //because its json, we'll let the client decide how to render it
          step_header_text: "FINALIZING...",
        }
      },
      {
        name: "done",
        type: "pipeline_complete",
        description: "Done!",
        progress: 100,
        config: {
          input_key: "writeup",
          response_type: "document_url"
        }
      }


    ]
  }
}
module.exports = { load }
