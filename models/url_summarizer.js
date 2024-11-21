const load = () => {
    return {
      "pipeline_name": "conditional_url_summarizer",
      "steps": [
        // {
        //   "name": "claim_loader",
        //   "type": "tool",
        //   "description": "Loads the claim to be fact-checked",
        //   "config": {
        //     "tool_id": "multiTool",
        //     "input_key": "userRequest",
        //     "output_key": "claim",
        //   }
        // },
        // {
        //   "name": "fact_check",
        //   "type": "standard_inference",
        //   "config": {
        //     "temperature": 0.66,
        //     "max_tokens": 8192,
        //     "model_vendor": "perplexity",
        //     "model_id": "llama-3.1-sonar-huge-128k-online",
        //     "response_format": "text",
        //     "system_prompt": "You are a highly accurate and reliable fact-checker. Your job is to verify the truthfulness of the provided claim. Respond with 'True', 'False', or 'Inconclusive', followed by a detailed explanation and supporting evidence with sources.",
        //     "user_prompt": "Claim: {claim}\n\nPlease cite all sources as a numbered list at the end of your response, including their URLs",
        //     "input_key": "claim",
        //     "output_key": "fact_check_result"
        //   }
        // }
        {
          "name": "summarize_attached_url",
          "type": "standard_inference",
          "config": {
            "temperature": 0.3,
            "max_tokens": 8192,
            "model_vendor": "cohere",
            "model_id": "command-r-plus-08-2024",
            tool_options: {
              web: true
            },
            "system_prompt": "You are a research assistant and your job is to extract the contents of webpages, articles, and other online resources. If the user's prompt contains a URL, provide the full text of its contents, as well as author, title, and date (if available). If it does not contain a URL, return 'undefined'",
            "user_prompt": "{userRequest}",
            "input_key": "userRequest",
            "output_key": "summarized_url"
          }
        }

      ]
    }
  }
  
  module.exports = { load }