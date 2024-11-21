const transforms = require('../../lib/utils').transforms
const load = () => {return {
  "pipeline_name": "policy_analysis",
  "steps": [
      {
        "name": "research",
        "type": "standard_inference",
        "config": {
          "temperature": 0.3,
          "max_tokens": 4096,
          "model_vendor": "perplexity",
          "model_id": "llama-3.1-sonar-huge-128k-online",
          "system_prompt": "You are a precise and concise researcher. Please answer the question, based on the context",
          "user_prompt": "Context: \n\n{userRequest}\n\n{task}\n\nSearch the web to answer the question. Cite all sources used including URL",
          "input_key": "userRequest",
          "output_key": "results",
        }
      },
  
  ]
}}

module.exports={load}