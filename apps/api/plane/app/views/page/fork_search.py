# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ProjectPagePermission
from plane.db.models import Page
from ..base import BaseAPIView

# How much context to include on either side of the first body match.
SNIPPET_RADIUS = 60
MAX_RESULTS = 50


def _build_snippet(text, query):
    """Return a short excerpt of `text` centred on the first occurrence of `query`,
    or None when the body doesn't contain the query."""
    if not text:
        return None
    index = text.lower().find(query.lower())
    if index == -1:
        return None
    start = max(0, index - SNIPPET_RADIUS)
    end = min(len(text), index + len(query) + SNIPPET_RADIUS)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


class ProjectPageSearchEndpoint(BaseAPIView):
    """
    Fork: search a project's pages by title AND body text.

    The list endpoint's DRF `search_fields` only covers `name`; this endpoint also
    matches `description_stripped` (the server-maintained plain-text body) and returns
    a snippet around the first body match so the client can show context.
    """

    permission_classes = [ProjectPagePermission]

    def get(self, request, slug, project_id):
        query = request.GET.get("query", "").strip()
        if not query:
            return Response([], status=status.HTTP_200_OK)

        pages = (
            Page.objects.filter(
                workspace__slug=slug,
                # Active project link only — a page removed from the project must not
                # surface through search (same scoping as the version endpoint).
                project_pages__project_id=project_id,
                project_pages__deleted_at__isnull=True,
            )
            # Private pages are only visible to their owner, matching the list endpoint.
            .filter(Q(owned_by=request.user) | Q(access=0))
            .filter(Q(name__icontains=query) | Q(description_stripped__icontains=query))
            .distinct()
            .order_by("-updated_at")
            .values(
                "id",
                "name",
                "parent_id",
                "access",
                "archived_at",
                "logo_props",
                "description_stripped",
            )[:MAX_RESULTS]
        )

        results = [
            {
                "id": page["id"],
                "name": page["name"],
                "parent": page["parent_id"],
                "access": page["access"],
                "archived_at": page["archived_at"],
                "logo_props": page["logo_props"],
                "snippet": _build_snippet(page["description_stripped"], query),
            }
            for page in pages
        ]
        return Response(results, status=status.HTTP_200_OK)
