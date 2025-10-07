#!/bin/bash

set -e

echo "🚀 Setting up Nordpool Scheduler Card development environment..."

# Configure npm to use user directory for global packages
mkdir -p /home/node/.npm-global
npm config set prefix /home/node/.npm-global

# Add to PATH for this session and persist to profile
export PATH=/home/node/.npm-global/bin:$PATH
echo 'export PATH=/home/node/.npm-global/bin:$PATH' >> /home/node/.bashrc
echo 'export PATH=/home/node/.npm-global/bin:$PATH' >> /home/node/.profile

# Install Yarn globally (npm is already available as node user)
echo "📦 Installing Yarn globally..."
npm install -g yarn

# Install frontend dependencies
if [ -f "package.json" ]; then
    echo "📦 Installing dependencies with Yarn..."
    yarn install
fi

# Create dist directory
mkdir -p dist

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Run 'yarn build' to build the card"
echo "  2. Run 'yarn start' for development mode with hot reload"
echo "  3. The built card will be in the 'dist' folder"
echo ""
echo "🏠 To test with Home Assistant:"
echo "  1. Copy dist/nordpool-scheduler-card.js to your HA's www folder"
echo "  2. Add the resource in HA: /local/nordpool-scheduler-card.js"
echo "  3. Add the card to your dashboard"
echo ""
echo "💡 Development server will run on http://localhost:5000"
