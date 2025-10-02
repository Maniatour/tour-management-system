// ChatGPT API 서비스
interface ChatGPTResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface ChatGPTRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  max_tokens?: number
  temperature?: number
}

// ChatGPT API 호출 함수
export const callChatGPT = async (
  prompt: string,
  systemMessage?: string,
  maxTokens: number = 500,
  temperature: number = 0.7
): Promise<string> => {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경변수 NEXT_PUBLIC_OPENAI_API_KEY를 설정해주세요.')
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  
  if (systemMessage) {
    messages.push({ role: 'system', content: systemMessage })
  }
  
  messages.push({ role: 'user', content: prompt })

  const requestBody: ChatGPTRequest = {
    model: 'gpt-3.5-turbo',
    messages,
    max_tokens: maxTokens,
    temperature
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json()
      const errorMessage = errorData.error?.message || '알 수 없는 오류'
      
      // 할당량 초과 오류에 대한 친화적인 메시지
      if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
        throw new Error('OpenAI API 사용 한도를 초과했습니다. OpenAI 계정의 결제 정보와 월별 한도를 확인해주세요.')
      }
      
      throw new Error(`OpenAI API 오류: ${errorMessage}`)
    }

    const data: ChatGPTResponse = await response.json()
    
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content.trim()
    } else {
      throw new Error('ChatGPT 응답을 받을 수 없습니다.')
    }
  } catch (error) {
    console.error('ChatGPT API 호출 오류:', error)
    throw error
  }
}

// 투어 상품 제목 추천
export const suggestTourTitle = async (description: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 설명을 바탕으로 매력적이고 정확한 투어 제목을 한국어로 제안해주세요. 제목은 간결하고 명확해야 하며, 관광객의 관심을 끌 수 있어야 합니다.`
  
  const prompt = `다음 투어 설명을 바탕으로 매력적인 투어 제목을 제안해주세요:\n\n${description}\n\n제목만 간단히 제안해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 100, 0.8)
}

// 투어 설명 추천
export const suggestTourDescription = async (title: string, location?: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 제목과 위치를 바탕으로 매력적이고 상세한 투어 설명을 한국어로 작성해주세요. 설명은 관광객이 투어의 가치와 경험을 이해할 수 있도록 구체적이고 감동적으로 작성해야 합니다.`
  
  const prompt = `다음 정보를 바탕으로 투어 설명을 작성해주세요:\n제목: ${title}\n${location ? `위치: ${location}` : ''}\n\n투어의 특징, 볼거리, 경험할 수 있는 것들을 포함하여 매력적인 설명을 작성해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 300, 0.7)
}

// 투어 일정 제목 추천
export const suggestScheduleTitle = async (dayNumber: number, location?: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 일정 정보를 바탕으로 간결하고 명확한 일정 제목을 한국어로 제안해주세요.`
  
  const prompt = `다음 정보를 바탕으로 투어 일정 제목을 제안해주세요:\n일차: ${dayNumber}일차\n${location ? `위치: ${location}` : ''}\n\n간결하고 명확한 제목만 제안해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 50, 0.8)
}

// 투어 일정 설명 추천
export const suggestScheduleDescription = async (title: string, location?: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 일정 제목과 위치를 바탕으로 상세하고 매력적인 일정 설명을 한국어로 작성해주세요.`
  
  const prompt = `다음 정보를 바탕으로 투어 일정 설명을 작성해주세요:\n제목: ${title}\n${location ? `위치: ${location}` : ''}\n\n일정의 세부 내용, 볼거리, 경험할 수 있는 것들을 포함하여 상세한 설명을 작성해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 200, 0.7)
}

// 호텔 설명 추천
export const suggestHotelDescription = async (hotelName: string, location?: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 호텔 정보를 바탕으로 매력적이고 상세한 호텔 설명을 한국어로 작성해주세요.`
  
  const prompt = `다음 정보를 바탕으로 호텔 설명을 작성해주세요:\n호텔명: ${hotelName}\n${location ? `위치: ${location}` : ''}\n\n호텔의 특징, 편의시설, 주변 관광지 등을 포함하여 매력적인 설명을 작성해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 250, 0.7)
}

// FAQ 질문 추천
export const suggestFAQQuestion = async (topic: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 주제를 바탕으로 관광객들이 자주 묻는 질문을 한국어로 제안해주세요.`
  
  const prompt = `다음 주제에 대한 자주 묻는 질문을 제안해주세요:\n주제: ${topic}\n\n관광객들이 실제로 궁금해할 만한 질문을 제안해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 100, 0.8)
}

// FAQ 답변 추천
export const suggestFAQAnswer = async (question: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 질문에 대해 정확하고 도움이 되는 답변을 한국어로 작성해주세요.`
  
  const prompt = `다음 질문에 대한 답변을 작성해주세요:\n질문: ${question}\n\n정확하고 도움이 되는 답변을 작성해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 200, 0.7)
}

// 문서 템플릿 제목 추천
export const suggestDocumentTemplateSubject = async (templateType: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 템플릿 유형을 바탕으로 적절한 문서 제목을 한국어로 제안해주세요.`
  
  const prompt = `다음 템플릿 유형에 대한 문서 제목을 제안해주세요:\n템플릿 유형: ${templateType}\n\n투어 관련 문서에 적합한 명확하고 간결한 제목을 제안해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 100, 0.8)
}

// 문서 템플릿 내용 추천
export const suggestDocumentTemplateContent = async (subject: string, templateType: string): Promise<string> => {
  const systemMessage = `당신은 한국의 투어 가이드 전문가입니다. 주어진 제목과 템플릿 유형을 바탕으로 전문적이고 상세한 문서 내용을 한국어로 작성해주세요.`
  
  const prompt = `다음 정보를 바탕으로 문서 내용을 작성해주세요:\n제목: ${subject}\n템플릿 유형: ${templateType}\n\n투어 관련 문서에 적합한 전문적이고 상세한 내용을 작성해주세요.`
  
  return await callChatGPT(prompt, systemMessage, 500, 0.7)
}
