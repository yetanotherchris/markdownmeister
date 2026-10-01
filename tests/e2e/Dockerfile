FROM mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e
RUN npm install --prefix /opt/node22 node@22.23.3
RUN npm install --prefix /opt/npm12 npm@12.2.0
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-bin && rm -rf /var/lib/apt/lists/*
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
COPY --chown=pwuser:pwuser tsconfig*.json ./
USER pwuser
ENV HOME=/home/pwuser
