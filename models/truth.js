    const load = () => {return {
      "pipeline_name": "policy_analysis",
      "steps": [
        {
          "name": "universal_loader",
          description: "accepts text, URLs, and file uploads",
          type: "tool",
          config: {
            input_key: "userRequest",
            output_key: "document",
            tool_id: "multiTool",   //Can use any function exported from utils
            tool_options:{no_jina:false}
            //For a one off tool, or a user-created tool. here's a tool's implementation... as long as it takes one input, and returns one ouput, you're good to go
            // f: async(url) => {
            //           try {
            //             if (url.toLowerCase().startsWith("http")) {
            //               //we use the free JINA reader proxy that returns an LLM-friendly version of most websites
            //               const response = await fetch(`https://r.jina.ai/${url}`);
            //               if (!response.ok) {
            //                 throw new Error(`HTTP error! status: ${response.status}`);
            //               }
            //               const data = await response.text();
            //               return data;
            //             } else if (url.toLowerCase().startsWith("@")) {
            //               //TODO: attach file
            //             } else {
            //               return url //the user submitted text by pasting it in, so we need not mess with it
            //             }   
            //           } catch (error) {
            //             return `Error fetching URL: ${error.message}`;
            //           }
            //         }
            }
          },

        {
        "name": "factoid",
        "description": "Based on the provided source material, identifies specific claims or statements that should be fact checked. For large documents with lots of claims (i.e. Trump's election platform), we suggest turning on sampling to reduce costs",
        "type": "standard_inference",
        "config": {
          "temperature": 0.8,
          "max_tokens": 4096,
          "model_vendor": "google",
          "model_id": "gemini-1.5-pro-exp-0801",
          "response_format": "json_object",
          "system_prompt": `You are a research assistant at the Truthscan Inc. fact checking firm. Your job is to extract a list of claims made in the document that need to be fact checked. 
          Follow these instructions:
          1. Claims should stand alone and be something a trained fact checker can empirically prove or disprove.
          2. Each claim should be worded so that it makes sense by itself. For example, "Putin said [XYZ]" not "He said [XYZ]" 
          3. Sort claims by fact checking priority, highest to lowest`,
          "user_prompt": `Document For Review:\n\n{document}\n\nReturn JSON with a brief summary of the document as a whole, and a list of claims that need to be checked. 
          If there is any kind of error message indicating that an attachment failed to load, please do not return any claims. 
          If there are more than 20 claims, only include the 20 most relevant claims. Please format your JSON like 
          {
                summary: 'an article about ...', 
                claims: [
                  'claim 1', 
                  'claim 2'
                ]
          }`,
          "input_key": "document",
          "output_key": "factoids",
          tool_options: {show_as_code: true},
          output_to_client: true,
          output_to_display: false,
          step_header_text: "Extracting Claims...",

        }
      },
      {
        "name": "fact_check",
        "type": "mapper",
        "description": "AI Agents built on top of truthful-405b-instruct review each claim individually and assess its truthfulness. Each claim receives a label of true / false / indeterminate, along with a research report and the sources from which the fact checker got their information",

        "config": {
          "temperature": 0.8,
          "max_tokens": 1024,
          "model_vendor": "perplexity",
          "model_id": "llama-3.1-sonar-large-128k-online",
          "system_prompt": "You are Fact Checker @ AP News. Your job is to review a series of claims as they relate to a specified context, and determine if they are fact, fiction, or indeterminate. Please ensure that you always end your response with a numbered list of sources which corroborate the statements made in the submission, including the URL, in the body of the reply to the user. For this query, please consider accuracy and comprehensiveness are more important than speed. Please conduct an in-depth search and analysis unless otherwise requested. If there are too many claims, or for any other reason you are unable to perform these tasks, please reply with 429 service too busy",
          "user_prompt":  `Context: {summary}\n\nClaim to check: {task}\n. Format your output like: 

          ---

          ## <claim>

          ### Verdict: <FACT/FICTION/INDETERMINATE>

          <body of your report, explaining the verdict>
  
          ### Sources: 
          <numbered list of sources>

          ---

          `,
          "input_key": "factoids",
          "tasks_key": "claims",
          "output_key": "fact_check_results",
          "downsample_to": 20, //if more than 5 claims, 5 will be randomly sampled to save on inference costs. In production, set this higher 
        
          output_to_client: false,
          output_to_display: true,
          step_header_text: "Checking Claims...",


        }
      },
        {
          "name": "compile_report",
          "type": "reducer",
          "config": {
            "input_key": "fact_check_results",
            "output_key": "fact_check_report",
            "reduce_function": "concatenate",
            include_task_prompts: true,                //if true, both task prompt and task output will be included 
            task_prompt_prefix: "**Claim**: ",         //prepend to the prompt for each task... ignored if !include_prompts
            task_response_prefix:"",              //prepend to the output for each task
            delimiter: "\n---\n" ,                  //optional separator
            output_to_client: true,
            output_to_display: false,
            step_header_text: "Organizing Results...",
  
          }
        },
        
        {
          "name": "executive_summary",
          "description": `
          `,
          "type": "standard_inference",
          "config": {
            "temperature": 1.0,
            "max_tokens": 8192,
            "model_vendor": "google",
            "model_id": "gemini-1.5-pro-exp-0801",
                "system_prompt": "You are the team leader at TruthScan Inc. Please write a 1000-2000 word report that summarizes the findings of our fact checkers and assigns an overall rating to the submission",
            "user_prompt": `Original Document:\n\n{document}\n\nFact Checker Reports:\n\n{fact_check_report}\n\nCurrent Task: Write a 2-4 page detailed synopsis of the fact checker's findings for claims made in the document. 
            
            Use a nice clean markdown format and structure it like:
          
          
          ---
          # TruthScan Official Report
          
          ## Summary of document scanned: 
          <100 word synopsis of the provided material. Include title, author, URL to the document if available>
          
          ## Statistics

          - number of claims evaluated
          - number deemed fact
          - number deemed fiction
          - number deemed indeterminate or more info needed

          ## At A Glance...

          ## <claim>
          ### Verdict: <FACT/FICTION/INDETERMINATE>
          <100 word synopsis of findings and reason for verdict>

          ... etc. Provide claim, verdict, and summary for all claims analyzed by the fact checkers ...


          ## Overall TruthScore: NN / 100 (assign a score to the entire document based on aggregate findings of the fact checking team>)
          
          <200 word overview of the big picture, why you gave the score you did, and what the findings actually mean regarding the source's credibility>

          `,
            "input_key": "fact_check_report",
            "output_key": "exec_summary",
            output_to_client: true,
            output_to_display: true,
            step_header_text: "FINAL REPORT",

          }
        },
      
      ]
    }}
  
      


    module.exports = {load}


