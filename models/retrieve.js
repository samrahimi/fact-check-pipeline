const fs=require("fs")
const { url } = require("inspector")
const load = () => {
  return {
  "pipeline_name": "code_review",
  "steps":
    [
      {
        "name": "tool",
        "type": "tool",
        "description": "attachment loader",
        // config: {
        //         "input_key": "userRequest",
        //         "output_key": "prompt",
        //         tool_id: "multiTool"
        // }
        "config": {
          "input_key": "userRequest",
          "output_key": "prompt",
                      //The tool's implementation... as long as it takes one input, and returns one ouput, you're good to go
                      f: async(input) => {
                              let ctx = input.trim()

                              try {
                              const tokens = ctx.split(' ').map(x => x.trim())

                              //scrape and attach any remote resources included by user
                              const urls = tokens.filter(x => x.startsWith("@http://") || x.startsWith("@https://")).map(ref => ref.replace('@',''))
                              //console.log("[debug] Attaching web documentss: "+urls.join(", "))
    
                              for (let url of urls) {
                                let response =  await fetch(process.env.NO_JINA ? url: `https://r.jina.ai/${url}`);
                                if (!response.ok) {
                                  //throw new Error(`HTTP error! status: ${response.status}`);
                                  ctx = `\n[${url}]\nHTTP error! status: ${response.status}\n---\n${ctx}`

                                } else {
                                  const data = await response.text();
                                  ctx = `\n[${url}]\n${data}\n---\n${ctx}`
                                }
                              }

                              //attach a file on disk (i.e. something user uploaded via the webapp)
                              const files = tokens.filter(x => x.startsWith("@file://")).map(ref => ref.split("://")[1])
                              //console.log("[debug] Attaching files as context: "+files.join(", "))
                              files.forEach(ref => {
                                //console.log(ref)
                                const content = fs.readFileSync(ref)
                                ctx = `\n[${ref}]\n${content}\n---\n${ctx}`
                              })
                            }
                            catch (ex) {
                              console.error(ex.toString())
                            } 
                            return ctx
                            //Note: this loader is not multimodal... a good project to work on hint hint
                        }
                    }
      }   
    ,

    {
      "name": "needle_haystack",
      "type": "standard_inference",
      "config": {
        "temperature": 0.3,
        "model_vendor": "google",
        "model_id": "gemini-1.5-pro-exp-0801",
        "response_format": "json_object",
        "system_prompt": "{userRequest}",
        "user_prompt": "{prompt}",
        "input_key": "prompt",
        "output_key": "response"
      }
    },

  ]
}
}

module.exports={load}