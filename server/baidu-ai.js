const axios = require('axios');

class BaiduAI {
  constructor() {
    this.apiKey = 'nkErfiso85gdLoThlXXTBu0E'
    this.secretKey = 'c3triSuwoOMSjNVs9yliiqySgSr9YvjT'
    this.accessToken = null;
    this.tokenExpireTime = null;
  }

  // 获取访问令牌
  async getAccessToken() {
    // 检查令牌时效
    if (this.accessToken && this.tokenExpireTime && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      console.log('正在获取百度AI访问令牌...');
      
      const response = await axios.post(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.apiKey}&client_secret=${this.secretKey}`
      );

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        // 令牌搁29天重新获取
        this.tokenExpireTime = Date.now() + (29 * 24 * 60 * 60 * 1000);
        
        console.log('访问令牌获取成功');
        return this.accessToken;
      } else {
        throw new Error('获取访问令牌失败: ' + JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('获取百度AI访问令牌失败:', error);
      throw error;
    }
  }

  async generateContent(title, keywords = '') {
    try {
      const token = await this.getAccessToken();
      
      console.log(`百度AI正在为标题生成内容: "${title}"`);
      
      // 提示词
      const prompt = `请根据以下标题生成一篇博客文章的开头段落，要求语言生动有趣，长度在200字左右，适合博客阅读：标题：${title}，${keywords ? `关键词：${keywords}` : ''}`;

      const response = await axios.post(
        'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=' + token,
        {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8, 
          top_p: 0.8,
          penalty_score: 1.0
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.result) {
        console.log('百度AI内容生成成功');
        return response.data.result;
      } else {
        throw new Error('AI生成失败: ' + JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('百度AI生成失败:', error.message);
      
      return this.getFallbackContent(title, keywords);
    }
  }

  getFallbackContent(title, keywords = '') {
    console.log('🔄 使用智能降级内容生成');
    
    const templates = [
      `关于"${title}"，这是一个在当前社会备受关注的话题。随着时代的发展，人们对此有了更深入的认识和理解。`,
      `"${title}"作为一个重要的议题，涉及到我们生活的方方面面。本文将从多个角度探讨这一问题。`,
      `在探讨"${title}"时，我们需要综合考虑历史背景、现状分析以及未来展望。这个话题值得我们深入思考。`,
      `"${title}"不仅是一个理论问题，更与我们的日常生活息息相关。让我们一起来探索其中的奥秘。`,
      `面对"${title}"这一课题，不同的人可能有不同的看法。本文将尝试提供一个全面的视角。`
    ];
    
    const enhancements = [
      '首先，我们需要了解其基本概念和发展历程。',
      '从实践角度来看，这个问题具有重要的现实意义。',
      '值得注意的是，近年来这方面的研究取得了显著进展。',
      '在这个过程中，技术创新发挥着关键作用。',
      '对此，专家们提出了多种有价值的观点和建议。'
    ];
    
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    
    return randomTemplate + ' ' + randomEnhancement;
  }
}
const baiduAI = new BaiduAI();
module.exports = baiduAI;