FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f
RUN npm install --prefix /opt/node22 node@22.23.4
RUN npm install --prefix /opt/npm12 npm@12.2.0
RUN apt-get update && apt-get install -y --no-install-recommends binutils xz-utils libglib2.0-bin \
    && rm -rf /var/lib/apt/lists/*
ENV PATH="/opt/npm12/node_modules/.bin:/opt/node22/node_modules/node/bin:${PATH}"
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
RUN chown pwuser:pwuser /workspace
COPY --chown=pwuser:pwuser src/ src/
COPY --chown=pwuser:pwuser tests/ tests/
COPY --chown=pwuser:pwuser assets/ assets/
COPY --chown=pwuser:pwuser resources/ resources/
COPY --chown=pwuser:pwuser native/ native/
COPY --chown=pwuser:pwuser scripts/ scripts/
COPY --chown=pwuser:pwuser electron.vite.config.ts playwright.config.ts ./
COPY --chown=pwuser:pwuser electron-builder.yml ./
COPY --chown=pwuser:pwuser tsconfig*.json ./
USER pwuser
ENV HOME=/home/pwuser
