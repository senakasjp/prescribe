# OpenAI API Setup Guide

## 🤖 Setting Up AI Drug Interaction Testing

To enable AI-powered drug interaction testing in M-Prescribe, configure the OpenAI API key in Firebase Functions secrets.

## 📋 Prerequisites

1. **OpenAI Account**: Create an account at [OpenAI](https://platform.openai.com/)
2. **API Key**: Generate an API key from your OpenAI dashboard
3. **Billing**: Ensure you have billing set up (AI calls cost money)

## 🔧 Configuration Steps

### Step 1: Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in to your account
3. Navigate to **API Keys** section
4. Click **"Create new secret key"**
5. Copy the generated key (starts with `sk-`)

### Step 2: Configure Firebase Functions Secret

1. **Set the secret**:
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   ```

2. **Deploy functions**:
   ```bash
   firebase deploy --only functions
   ```

### Step 3: Verify Configuration

1. **Open the browser console** (F12)
2. **Add 2+ medications** to a prescription
3. **Click Complete/Send to Pharmacy/Print**
4. **Check console logs** for:
   - `🔍 OpenAI configured: true`
   - `🔍 Checking drug interactions...`

## 🚨 Troubleshooting

### Issue: "OpenAI is not configured"
**Solution**: Make sure the Functions secret is set:
```
firebase functions:secrets:set OPENAI_API_KEY
```

### Issue: "Not enough medications for interaction check"
**Solution**: Add at least 2 medications to the prescription before clicking the buttons.

### Issue: API errors or rate limits
**Solutions**:
- Check your OpenAI billing is set up
- Verify your API key is valid
- Check your usage limits in OpenAI dashboard

## 💰 Cost Information

- **Drug Interaction Analysis**: ~$0.01-0.05 per analysis
- **Token Usage**: Tracked in the admin panel
- **Free Tier**: OpenAI provides $5 free credit for new accounts

## 🔒 Security Notes

- **Never commit** OpenAI keys to version control
- **Keep your API key** private and secure
- **Monitor usage** through OpenAI dashboard
- **Set usage limits** to prevent unexpected charges

## 📊 Features Enabled

Once configured, you'll have access to:

- **AI Drug Interaction Analysis**: Comprehensive safety analysis
- **Severity Assessment**: Critical, High, Moderate, Low risk levels
- **Safety Recommendations**: Monitoring and warning advice
- **Real-time Analysis**: Immediate feedback before actions
- **Token Tracking**: Usage monitoring in admin panel

## 🎯 Testing the Setup

1. **Add 2+ medications** to a prescription
2. **Click Complete/Send to Pharmacy/Print**
3. **Look for**:
   - Loading spinner: "Checking for drug interactions..."
   - Results display with severity badges
   - Detailed interaction analysis

---

*For more information, see the [AI Features Documentation](AI_FEATURES.md)*
