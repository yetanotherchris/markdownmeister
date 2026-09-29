FROM mcr.microsoft.com/playwright:v1.62.1-noble
RUN npm install --prefix /opt/node22 node@22.23.3
ENV PATH="/opt/node22/node_modules/node/bin:${PATH}"
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
RUN chown pwuser:pwuser /workspace
COPY --chown=pwuser:pwuser . .
USER pwuser
ENV HOME=/home/pwuser
