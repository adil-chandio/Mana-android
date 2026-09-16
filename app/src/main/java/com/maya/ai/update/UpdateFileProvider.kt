package com.maya.ai.update

/** Separate provider identity avoids merging with the existing camera/file-share provider. */
class UpdateFileProvider : androidx.core.content.FileProvider()
