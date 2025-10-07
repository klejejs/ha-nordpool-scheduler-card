FROM node:20-bookworm

# Install basic dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    vim \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Yarn globally
RUN npm install -g yarn

# Setup user
ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN if [ "$USER_GID" != "1000" ] || [ "$USER_UID" != "1000" ]; then \
    groupmod --gid $USER_GID node \
    && usermod --uid $USER_UID --gid $USER_GID node \
    && chown -R $USER_UID:$USER_GID /home/node; \
    fi

# Add sudo support
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set working directory
WORKDIR /workspace

USER node
