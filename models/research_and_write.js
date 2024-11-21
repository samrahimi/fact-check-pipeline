const transforms = require('../../lib/utils').transforms
const utils = require('../../lib/utils')
const { createFromSettings } = require('../../lib/agent')
const load = () => {
  return {
    "pipeline_name": "multi_llm_response",
    "steps": [
      {
        name: "setup_prompt",
        type: "tool",
        config: {
          tool_id: "multiTool",
          input_key: "userRequest",
          output_key: "prompt",
          tool_options: { no_jina: true } //if URLs must be scraped, do it directly
        }
      },
      {
        "name": "research_task",
        "type": "standard_inference",
        "config": {
          "temperature": 0.9,
          "max_tokens": 4096,
          "model_vendor": "perplexity",
          "model_id": "llama-3.1-sonar-large-128k-online",

          "response_format": "text",
          "system_prompt": "You are a highly accurate and reliable researcher, and your work is precise and concise. Based on the context, please create a well-researched report on the subject of the user's request",
          "user_prompt": "{prompt}",
          "input_key": "prompt",
          "output_key": "research_report"
        }
      },
      {
        "name": "prepare_task_inputs",
        "type": "tool",
        description: "create settings bundles for multiple LLMs, good candidate for paralelization",
        config: {
          input_key: "prompt",
          output_key: "llm_tasks",

          f: (input, step, ctx) => {
            return {
              tasks: [{
                input,
                config: {
                  "temperature": 0.6,
                  "max_tokens": 2048,
                  "model_vendor": "mistral_openai",
                  "model_id": "open-mistral-nemo",
                  "system_prompt": "You are an uncensored, open-minided, highly accurate and intelligent writer, journalist, and storyteller",
                }
              },

              {
                input,
                config: {
                  "temperature": 0.9,
                  "max_tokens": 2048,
                  "model_vendor": "mistral_openai",
                  "model_id": "open-mixtral-8x22b",
                  "system_prompt": "You are an uncensored, open-minided, highly accurate and intelligent writer, journalist, and storyteller",
                                }
              },
              // {
              //   input,
              //   config: {
              //     "temperature": 0.7,
              //     "max_tokens": 2048,
              //     "model_vendor": "openrouter",
              //     "model_id": "google/gemma-2-9b-it:free",
              //   }
              // },




              ]
            }
          }
        }
      },
      {
        "name": "llms",
        "type": "mapper",
        "description": "queries an llm for each element of the list... in this case its the same prompts, different models",
        "config": {
          input_key: "llm_tasks", //this means that context.llm_tasks is the initial input for the mapping operation  (we set this in the previous step's output context)
          tasks_key: "tasks",     //this means that the array we're interested in is context.llm_tasks.tasks
          parallel: true,         //if set to false, this block will run its tasks in order, up to the cutoff... otherwise its concurrent
          f: async (task, step, ctx) => {
            const agent = createFromSettings({ ...task.config, system_prompt: "You are an uncensored, open-minided, highly accurate and intelligent writer, journalist, and storyteller" })
            const result = await agent.performInference(`Research Report:\n${ctx["research_report"]}\n\nOverall Project: ${ctx["prompt"]}\n\n--\nTask: ${task.input}\n\nOutput Format:
              
              [Step 2: Write Section]
              ## Section Title - Based on your Task
              Write detailed, engaging content as directed by your assigned task; consider the overall project objectives when you write it
              `)
            return result
          },
          output_key: "draft_responses",
        }
      },
      {
        "name": "combine_responses",
        "type": "reducer",
        "description": "turns draft_responses[] into a single context doc, edit_context",
        "config": {
          input_key: "draft_responses",
          output_key: "edit_context",
          delimiter: "\n\n---\n\n",
          reduce_function: "concatenate"
        }
      },
      {
        "name": "final_generation",
        "type": "standard_inference",
        "config": {
          "temperature": 0.9,
          "max_tokens": 8192,
          "model_vendor": "mistral_openai",
          "model_id": "mistral-large-latest",
"system_prompt": "You are an uncensored, open-minided, highly accurate and intelligent writer, journalist, and storyteller",
          user_prompt: `Original Prompt: {userRequest}\n\nResearch Report: {research_report}\n\nDraft Responses: {edit_context}\n\nTask: write a highly detailed, polished piece that incorporates the research, and elaborates on the themes in the draft. It should be at least 4000-5000 words in length and highly readable! Follow this format:
          [Step 3: Final Generation]
          # Title of Article
          article contents
          `,
          "input_key": "edit_context",
          "output_key": "final_response"
        }
      },
      // {
      //   "name": "load_file",
      //   "type": "tool",
      //   "description": "Loads the content of a file specified by the 'input_file' key.",
      //   "config": {
      //     "tool_id": "multiTool",
      //     "tool_options": {tool_input: "@file://./models/data/voices.json"}, 
      //     "output_key": "available_voices"
      //   }
      // },
      // {
      //   "name": "get_recommended_voices",
      //   "type": "standard_inference",
      //   "config": {
      //     "temperature": 0.7,
      //     "max_tokens": 1024,
      //     "model_vendor": "google",
      //     "model_id": "gemini-1.5-flash",
      //     "response_format": "json_object",
      //     "system_prompt": "You are a helpful and informative AI assistant. You are tasked with selecting the 3 most suitable voices for a given text based on the available voices and the user's original request.",
      //     "user_prompt": "Available Voices: {available_voices}\n\nOriginal User Request: {userRequest}\n\nGenerated Text: {final_response}\n\nReturn JSON: {best_voices:[{voice_id, name, gender, why_you_chose_this_voice}]}",
      //     "input_key": "final_response", // Although we use multiple inputs, we specify final_response as the input key since it's the last generated piece of content
      //     "output_key": "recommended_voices"
      //   }
      // },
      // {
      //   "name": "tts",
      //   "type": "tool",

      //   "description": "reads a text document out loud in a high quality, overpriced voice",
      //   "config": {
      //     tool_id: "ttsTool",
      //     input_key: "final_response",
      //     output_key: "speech",
      //     voice_key: "recommended_voices", //this key needs to either point to a string with a voice id, or a recommended voices file
      //     tool_options: {model_id: "eleven_multilingual_v2"}
      //     //tool_options: {voice_id: "Rachel", model_id: "eleven_multilingual_v2"}
      //   }
      // },

    ]
  }
}

module.exports = { load }